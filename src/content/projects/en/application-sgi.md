---
title: "Bursar Office Management System (SGI)"
context: "\"Supply order requests\" module"
githubLink: "https://github.com/LucaBONNIN/application-sgi"
liveLink: "https://app-sgi.127011.xyz"
ficheDescriptiveLink: "/documents/E6/BLONDEL_WILLIAM_ANNEXE_VII-1-B_R2.pdf"
projectManagementLink: "https://trello.com/b/eIcnlMPs/application-sgi"
bts: "e6"
order: 1
draft: false
coverImage: "../../../assets/projects/application-sgi/cover.jpg"
---

# Detailed report

## 1. Context and organisation

| Item | Detail |
| --- | --- |
| **Host organisation** | Lycée Corneille (La Celle-Saint-Cloud) |
| **Business sponsor** | School's Bursar Office (Service Intendance) |
| **Project team** | William Blondel, Luca Bonnin, Nicolas Ignacio |
| **Method** | Scrum, 1 to 2-week sprints |
| **Period** | 22 January 2026 → 25 March 2026 (5 sprints) |
| **Volume** | 25 user stories, 63 tickets, 116 story points delivered |
| **Tracking tools** | [Trello](https://trello.com/b/eIcnlMPs/application-sgi) + [Gestion_Projet_App_SGI.xlsx](/documents/E6/Gestion_Projet_App_SGI.xlsx) workbook |

### 1.1 Business problem

The Bursar Office receives all the school's operational requests (supply orders, school trips, theatre bookings, etc.) through heterogeneous channels: paper mail, e-mail, the school's digital workspace (ENT), phone calls. This dispersion causes:

- **information loss** (misplaced requests, untraced back-and-forth);
- **long processing times**;
- **lack of traceability** (who requested what, when, from whom?);
- **lack of prioritisation** of requests;
- **lack of overall visibility** on the Bursar Office's activity.

### 1.2 Functional target

Eventually, the SGI web application should centralise **three features** (prioritised by the Bursar Office team):

1. **Supply order requests** — *delivered in this iteration*.
2. School trip organisation.
3. Theatre bookings.

This report deals exclusively with **feature 1**.

---

## 2. Preliminary study and technical choices

The detailed study (PHP frameworks, *admin panels*, deployment platforms) is recorded in the [Comparative study and technological choices](https://github.com/LucaBONNIN/application-sgi/blob/master/.docs/Etude_Comparative_et_Choix_Technologiques.md) document.

| Layer | Selected choice | Summarised justification |
| --- | --- | --- |
| Language | **PHP 8.4** | Mastered by the team, mature ecosystem. |
| Backend framework | **Laravel 12** | Development speed, Eloquent, ecosystem (Horizon, Auditing, Shield). |
| UI framework | **Filament v5** | SDUI: no manual HTML/CSS/JS. CRUDs, complex forms, *role-aware*, native handling of `Repeater` and `FileUpload`. |
| DBMS | **PostgreSQL 16** | Strict integrity constraints, advanced types. |
| Queue | **Redis** + **Laravel Horizon** | Asynchronous notifications (e-mails) without blocking requests. |
| Local mail | **Mailpit** | SMTP "trap" to view e-mails without actually sending them. |
| Containerisation | **Spin Pro** (Docker) | Consistent environment for the 3 developers (`spin up`). |
| IDE | **PhpStorm + Laravel Idea** | Static analysis, autocompletion on Laravel's magic facades. |
| Versioning | **Git + GitHub** | Feature branches, Pull Requests, peer reviews. |
| Formatting | **Laravel Pint** (PSR-12) | Automatic uniform style before each commit. |
| Tests | **PHPUnit 11** | Unit tests + Filament/Livewire feature tests. |

The environment is documented in the [Development environment and architecture](https://github.com/LucaBONNIN/application-sgi/blob/master/.docs/Environnement_de_Developpement_et_Architecture.md) document.

---

## 3. Application architecture

### 3.1 Data model

7 business tables (excluding `users`, `cache`, `jobs`, `audits`, `permissions`, `vacation_periods`):

| Table | Role | Main relationships |
| --- | --- | --- |
| `users` | Named accounts (requesters and administrators) | `belongsToMany services`, `hasMany orders` |
| `services` | School services / disciplines | `belongsToMany users`, `hasMany budgets`, `hasMany orders` |
| `service_user` | User ↔ service assignment pivot | — |
| `budgets` | Annual budget per service | `belongsTo service`, `hasMany orders` |
| `suppliers` | Suppliers (name, SIRET, contact, URL) | `hasMany orders` |
| `categories` | Product categories | `hasMany orderLines` |
| `orders` | Order request | `belongsTo user`, `service`, `supplier`, `budget`, `hasMany lines`, typed `OrderStatus` |
| `order_lines` | Product line of an order | `belongsTo order`, `category` |
| `vacation_periods` | School holiday periods (Zone C) | used by `OrderAgeCalculator` |
| `audits` | Trace of every sensitive action | `morphTo` |

![Eloquent models class diagram](../../../assets/projects/application-sgi/diagrams/models_class_diagram.png)
*<p align="center">Figure 1 — Eloquent models class diagram</p>*

### 3.2 Application architecture

The application follows the standard Laravel 12 / Filament v5 structure:

```
app/
├── Enums/                  # OrderStatus (state machine + Filament contracts)
├── Filament/App/Resources/ # Filament resources (Orders, Budgets, Categories, Services,
│                           #   Suppliers, Users, VacationPeriods, Audit) split into
│                           #   {Resource}, Schemas/, Tables/, Pages/, RelationManagers/
├── Listeners/              # Auditing of authentication events
├── Models/                 # Eloquent models + Auditable traits
├── Notifications/          # OrderCreated, OrderStatusChanged (ShouldQueue)
├── Policies/               # OrderPolicy, BudgetPolicy, VacationPeriodPolicy, ...
├── Providers/              # AppPanelProvider (Filament)
└── Services/               # OrderAgeCalculator (business-day computation)
```

![Filament resources class diagram](../../../assets/projects/application-sgi/diagrams/filament_class_diagram.svg)
*<p align="center">Figure 2 — Filament resources class diagram</p>*

### 3.3 Patterns used

- **Server-Driven UI**: the entire interface is defined in PHP (no manual HTML/CSS/JS).
- **State machine** centralised on the `OrderStatus` enum (`allowedTransitions`, `canTransitionTo`, `isTerminal`): *single source of truth* for transitions.
- **Laravel Policies** enforcing authorisation rules on every business action (CRUD + transitions).
- **Form Requests / Filament validation**: declarative validation rules (including **conditional** validation on the presence of the PDF quote).
- **Service Layer** isolating complex business logic (`OrderAgeCalculator`).
- **Queued Notifications** (`ShouldQueue`) processed by Laravel Horizon.
- Automatic **audit trail** on all business models (`owen-it/laravel-auditing`).

---

## 4. Functional description

### 4.1 Actors and roles

| Actor | Shield role | Main capabilities |
| --- | --- | --- |
| **Requester** (teacher, administrative staff) | `demandeurs` | Creates their own order requests, tracks their status, can cancel as long as the request is `Sent`, only sees their own orders. |
| **Bursar Office** | `super_admin` | Global view (all orders, all users), validation, status transitions, reference data management (services, budgets, suppliers, categories, school holidays). `BypassOwnership:Order` permission. |

### 4.2 Request lifecycle

![State machine — Order request lifecycle](../../../assets/projects/application-sgi/diagrams/order_status_workflow.svg)
*<p align="center">Figure 3 — State machine — Order request lifecycle</p>*

Terminal statuses: `Closed`, `Cancelled`. Any invalid transition attempt is rejected by `OrderStatus::canTransitionTo()` **and** by the `OrderPolicy` (defence in depth).

### 4.3 "Create a request" flow

1. The requester opens the **New request** screen.
2. They select the **service** (filtered to their assigned services), the **supplier** (search), and enter a **description**.
3. They can **optionally attach a PDF quote** (10 MB max). If a quote is attached, **the reference and unit price become mandatory** on each line.
4. They add the **product lines** through the `Repeater` (category, reference, designation, quantity, unit price). The **total is automatically computed**. At least one line is required; negative prices are forbidden.
5. On creation, `mutateFormDataBeforeCreate()` forces `user_id` to the current requester and `status = Sent`.
6. `afterCreate()` triggers the `OrderCreated` notification to all `super_admin` users.

![Order creation form](../../../assets/projects/application-sgi/screenshots/Formulaire_Création_Demande_Vide.png)
*<p align="center">Figure 4 — Order creation form (empty)</p>*

![Form with attached PDF quote](../../../assets/projects/application-sgi/screenshots/Formulaire_Création_Demande_Avec_Devis.png)
*<p align="center">Figure 5 — Order creation form with attached PDF quote</p>*

![Order lines repeater](../../../assets/projects/application-sgi/screenshots/Repeater_des_lignes_de_commande.png)
*<p align="center">Figure 6 — Order lines repeater</p>*

### 4.4 "Bursar Office processing" flow

1. The administrator receives the `OrderCreated` e-mail.
2. They open the order and click the **"Process"** action: a modal asks them to select a **budget** among those of the order's service. The status moves to `Processing` and `budget_id` is filled in.
3. They then click **"Mark as ordered"**: a modal with a `DatePicker` for the **estimated delivery date**. Status → `Ordered`.
4. When the products physically arrive, they click **"Mark as received"**: status → `Received`.
5. Once the products are handed over to the requesting service, they click **"Close"**: status → `Closed` (terminal).
6. On every transition, the `OrderStatusChanged` notification is sent to the requester (previous status, new status, supplier, service, direct link).

![Orders list (administrator view)](../../../assets/projects/application-sgi/screenshots/Liste_demandes_vue_Administrateur.png)
*<p align="center">Figure 7 — Orders list (administrator view)</p>*

![Orders list (requester view)](../../../assets/projects/application-sgi/screenshots/Liste_demandes_vue_demandeur.png)
*<p align="center">Figure 8 — Orders list (requester view)</p>*

![Editing an order with status "Sent"](../../../assets/projects/application-sgi/screenshots/edition_commande_status_sent_en_tant_que_admin.png)
*<p align="center">Figure 9 — Edit page of an order with status "Sent" (administrator view)</p>*

!["Process" modal (processOrder)](../../../assets/projects/application-sgi/screenshots/modale_traiter_commande.png)
*<p align="center">Figure 10 — "Process" modal (processOrder) (administrator view)</p>*

!["Order" modal (markOrdered)](../../../assets/projects/application-sgi/screenshots/modale_commander.png)
*<p align="center">Figure 11 — "Order" modal (markOrdered) (administrator view)</p>*

![OrderCreated email sent to administrators upon order creation](../../../assets/projects/application-sgi/screenshots/email_nouvelle_demande.png)
*<p align="center">Figure 12 — OrderCreated email sent to administrators upon order creation</p>*

![OrderStatusChanged email sent to the requester upon a status transition](../../../assets/projects/application-sgi/screenshots/email_changement_statut.png)
*<p align="center">Figure 13 - OrderStatusChanged email sent to the requester upon a status transition</p>*

### 4.5 Age business rule

The `OrderAgeCalculator::calculateBusinessDays()` service computes the number of business days between two dates, excluding:

- **weekends** (Saturday, Sunday);
- **school holiday periods** (Zone C — Paris) loaded from the `vacation_periods` table via the `scopeOverlapping` scope.

The age is shown in the orders table (with a "d" suffix), `null` for terminal statuses.

---

## 5. Security and authorisations

- **Authentication**: native Laravel, optional MFA via Filament (ENT integration is planned for a later iteration).
- **Authorisation**: fine-grained RBAC via Filament Shield. Two roles: `super_admin` and `demandeurs`. Granular permissions per resource and per action (`ViewAny:Order`, `View:Order`, `Update:Order`, `BypassOwnership:Order`, etc.).
- **Eloquent filtering** in `OrderResource::getEloquentQuery()`: a requester can only retrieve their own orders. The restriction is applied at the query level, not only at display time.
- **Policies**: the `OrderPolicy` covers CRUD operations **and** status transitions (`processOrder`, `markOrdered`, `markReceived`, `closeOrder`, `cancelOrder`). The business rule "a requester can only edit their order while it is `Sent`" is encoded in a single place.
- **Audit**: all models implement `Auditable`, and authentication events (login and logout) are also audited via `Listeners/`.

![Role management (Filament Shield)](../../../assets/projects/application-sgi/screenshots/gestion_des_roles.png)
*<p align="center">Figure 14 - Role management (Filament Shield)</p>*

![Permission management (Filament Shield)](../../../assets/projects/application-sgi/screenshots/gestion_des_permissions.jpg#autoscroll&duration=15)
*<p align="center">Figure 15 - Permission management (Filament Shield)</p>*

![Audit history](../../../assets/projects/application-sgi/screenshots/historique_audit.png)
*<p align="center">Figure 16 - Audit history</p>*

---

## 6. Testing strategy

All test classes are located in the `tests/` folder.

Unit tests are in `tests/Unit/` and feature tests are in `tests/Feature/`.

| File | Tests | Coverage |
| --- | --- | --- |
| `Unit/OrderAgeCalculatorTest.php` | 9 | Business days, weekends excluded, holidays excluded, edge cases (`from >= to`, empty interval). |
| `Unit/OrderStatusTest.php` | 7 | All valid and invalid transitions, terminal state, non-terminal state. |
| `Feature/DemoBannerTest.php` | 3 | Display of the demo-mode banner and the test credentials. |
| `Feature/Filament/Budgets/CreateBudgetTest.php` | 4 | Budget creation, euros-to-cents conversion, year validation. |
| `Feature/Filament/Budgets/EditBudgetTest.php` | 1 | Redirection after editing. |
| `Feature/Filament/Categories/CreateCategoryTest.php` | 7 | Category creation, automatic slug generation, redirection. |
| `Feature/Filament/Categories/EditCategoryTest.php` | 1 | Redirection after editing. |
| `Feature/Filament/Orders/CreateOrderTest.php` | 8 | Order creation, automatic `user_id` fill, automatic `Sent` status, admin notification, conditional validations, euros-to-cents conversion. |
| `Feature/Filament/Orders/ListOrdersTest.php` | 5 | Page loading, admin / requester view, filters. |
| `Feature/Filament/Suppliers/SupplierResourceTest.php` | 4 | Page loading, admin / requester access, supplier creation. |
| `Feature/Notifications/OrderNotificationTest.php` | 6 | E-mail content, channels, `toArray` payload for `OrderCreated` and `OrderStatusChanged`. |
| `Feature/OrderPolicyTest.php` | 28 | Admin/requester CRUD, `cancel`, `processOrder`, `markOrdered`, `markReceived`, `closeOrder`. |
| `Feature/ResetDemoCommandTest.php` | 1 | Removal of uploaded files when resetting the demo instance. |

**Total: 84 tests, 217 assertions.**

Run: `spin run php artisan test`.

<script src="https://asciinema.org/a/ePUD6pDv0VOkqIWm.js" id="asciicast-ePUD6pDv0VOkqIWm" async="true"></script>
*<p align="center">Figure 17 - PHPUnit test output</p>*

---

## 7. Internationalisation

The interface is fully translated into **French** and **English** for the `Order` and `VacationPeriod` resources (labels, sections, actions, fields, descriptions). The other resources inherit the base Filament translations provided by `laravel-lang/lang`.

![School holidays display (French)](../../../assets/projects/application-sgi/screenshots/liste_vacances_scolaires_fr.png#langtab=fr)
![School holidays display (English)](../../../assets/projects/application-sgi/screenshots/liste_vacances_scolaires_en.png#langtab=en)
*<p align="center">Figure 18 - School holidays display</p>*

---

## 8. Planning and delivery

| Sprint | Period | Goal | Pts | Tickets |
| :---: | --- | --- | :---: | :---: |
| **0** - Framing | 22/01 → 28/01/2026 | Tech stack choice, Spin Pro environment, blank Laravel project | 15 | 6 |
| **1** - Foundation | 29/01 → 11/02/2026 | Migrations, models, `OrderStatus` enum, factories, Shield | 23 | 16 |
| **2** - CRUD & form | 12/02 → 25/02/2026 | Filament resources, role-aware form, PDF upload, repeater, policies | 29 | 14 |
| **3** - Workflow & domain | 26/02 → 11/03/2026 | State machine, transition actions, school holidays, age calculator | 30 | 15 |
| **4** - Notifications, i18n & tests | 12/03 → 25/03/2026 | Queued notifications, FR/EN translations, complete PHPUnit suite | 19 | 12 |
| **Total** | | | **116** | **63** |

### Workload per developer

| Developer | Story points | Share |
| --- | :---: | :---: |
| William Blondel | 51 | 44 % |
| Luca Bonnin | 33 | 28 % |
| Nicolas Ignacio | 32 | 28 % |
| **Total** | **116** | **100 %** |

![Audit history](../../../assets/projects/application-sgi/screenshots/trello.png)
*<p align="center">Figure 19 - Project Trello board</p>*

---

## 9. Review

### 9.1 Skills demonstrated (BTS SIO reference framework)

#### 9.1.1 Block 2 — Application design and development (E6 SLAM)

| Skill | How it was demonstrated in this project |
|---|---|
| **Analyse a stated need and its legal context** | Interviews with the Bursar Office, formalisation of the need into user stories on Trello, taking traceability into account (audit via `owen-it/laravel-auditing` on all business models and on authentication events) and GDPR (named accounts, purpose limited to supply order requests, deletion of uploaded files when resetting the demo instance). |
| **Take part in designing the architecture of an application solution** | Stack choices (Laravel 12 + Filament v5 + PostgreSQL 16 + Redis + Horizon) justified in the [comparative study](https://github.com/LucaBONNIN/application-sgi/blob/master/.docs/Etude_Comparative_et_Choix_Technologiques.md), layer-based split (`Filament/App/Resources/`, `Models/`, `Policies/`, `Services/`, `Notifications/`, `Listeners/`, `Enums/`), state machine centralised on the `OrderStatus` enum as a single source of truth. |
| **Model an application solution** | Conceptual data model with 7 business tables, Eloquent models class diagram (figure 1), Filament resources class diagram (figure 2), state machine of the order request lifecycle (figure 3). |
| **Use the resources of an application framework** | Eloquent ORM, Form Requests, Policies, `ShouldQueue` Notifications processed by Laravel Horizon, automatic Auditing, Filament v5 in *Server-Driven UI*, Filament Shield for RBAC, Livewire for server-side reactivity. |
| **Identify, develop, use or adapt software components** | Reused and configured third-party Filament components (`Repeater`, `FileUpload`, `Action`, `RelationManager`), in-house components (`OrderAgeCalculator`, `OrderStatus` enum carrying transitions, *role-aware* `LinesRelationManager`), integrated third-party libraries (`owen-it/laravel-auditing`, `bezhansalleh/filament-shield`, `laravel-lang/lang`). |
| **Use Web technologies to implement exchanges between applications, including mobile** | Responsive web application accessible from mobile, HTTP/Livewire exchanges (reactivity without full reload), transactional e-mail notifications via SMTP (Mailpit in dev), HTTP upload of PDF files (10 MB max), session-based Laravel web authentication. |
| **Use data access components** | Eloquent ORM, typed relationships (`belongsTo`, `hasMany`, `belongsToMany`, `morphTo`), named scopes (`scopeOverlapping` for school holidays), N+1 avoidance via eager loading, factories and seeders for development data and tests. |
| **Continuously integrate versions of an application solution** | Git + GitHub, feature branches, Pull Requests, peer reviews between the three developers, Laravel Pint (PSR-12) before each commit, reproducible Docker environment via Spin Pro (`spin up`). |
| **Carry out the tests required to validate or release a service** | **84 PHPUnit tests / 217 assertions** covering happy paths, error cases and edge cases: `OrderAgeCalculatorTest`, `OrderStatusTest`, `OrderPolicyTest`, `CreateOrderTest`, `OrderNotificationTest`, `DemoBannerTest`, `ResetDemoCommandTest` (cf. table in section 6). |
| **Write technical and user documentation** | [Comparative study and technological choices](https://github.com/LucaBONNIN/application-sgi/blob/master/.docs/Etude_Comparative_et_Choix_Technologiques.md), [Development environment and architecture](https://github.com/LucaBONNIN/application-sgi/blob/master/.docs/Environnement_de_Developpement_et_Architecture.md), descriptive sheet [Annexe VII-1-B](/documents/E6/BLONDEL_WILLIAM_ANNEXE_VII-1-B_R2.pdf), this report, class diagrams versioned in `.docs/`. |
| **Use the features of a development and testing environment** | PhpStorm + Laravel Idea (static analysis, autocompletion on magic facades), Spin Pro (Docker), Mailpit (test SMTP), Laravel Horizon (queue supervision), Laravel Boost MCP, Xdebug. |
| **Assess the quality of an application solution** | Laravel Pint (PSR-12) automatically applied before each commit, suite of **84 PHPUnit tests / 217 assertions** run locally, peer reviews on Pull Requests between the three developers, monitoring of N+1 queries and response times in development. |
| **Analyse and fix a malfunction** | Bug reproduction locally under Spin Pro, diagnosis from Laravel logs and the `audits` table, fix and addition of a regression test. Concrete examples: conditional validation in the `Repeater` (mandatory fields if a PDF quote is attached) corrected after review; the rule "a requester can only edit their order while it is `Sent`" centralised in the `OrderPolicy` after duplication was detected. |
| **Update technical and user documentation** | Updates of class diagrams after every structural sprint (addition of models, addition of the state machine), updates of the comparative study as technical decisions were made, updates of the FR/EN translations whenever a field was added to a Filament resource. |
| **Develop and run tests on the updated elements** | At every major change, addition of dedicated tests: `OrderAgeCalculatorTest` when introducing the age calculation, `OrderStatusTest` and `OrderPolicyTest` when adding the status transitions, `OrderNotificationTest` when wiring up the e-mail notifications, `ResetDemoCommandTest` when implementing the demo instance reset command. |
| **Query data using a query language** | Typed Eloquent queries, named scopes (`scopeOverlapping`), *Eloquent* filtering in `OrderResource::getEloquentQuery()` (a requester only retrieves their own orders at the query level), inspectable underlying SQL queries, automatic euros ↔ cents conversion for monetary columns. |
| **Develop application features within a database management system (relational or non-relational)** | PostgreSQL integrity constraints declared in migrations (foreign keys with `cascadeOnDelete`, `unique`, `notNullable`), traceability via the `audits` table (polymorphic, written automatically on every change), `service_user` pivot table for the many-to-many relationship, Laravel-side ENUM types backed by `string` constraints on the DBMS side. |
| **Design or adapt a database** | Relational model with 7 business tables (figure 1), choice of relationships and cardinalities, design of the `service_user` pivot table, design of the `vacation_periods` table for school holidays (Zone C), incremental schema evolution sprint after sprint via Laravel migrations. |
| **Administer and deploy a database** | Versioned migrations (`php artisan migrate`), rollbacks (`php artisan migrate:rollback`), seeders for the demo dataset and the tests, persistence in a dedicated Docker volume, PostgreSQL environment automatically provisioned by Spin Pro, `app:reset-demo` command to reset the demo instance between two runs. |

#### 9.1.2 Block 1 — Support and provision of IT services (E5)

This project also contributes to covering the E5 reference framework. The table below lists the sub-skills this work allows to be demonstrated; the others are covered by other portfolio items.

| Skill | How it was demonstrated in this project |
|---|---|
| **Use reference frameworks, norms and standards** | PSR-12 automatically enforced by Laravel Pint before each commit, GDPR (named accounts, purpose limited to supply order requests, effective deletion of uploaded files when resetting the demo instance), Filament v5 conventions, Eloquent / Laravel conventions. |
| **Set up and verify the access levels associated with a service** | Fine-grained RBAC via **Filament Shield**: two roles (`super_admin`, `demandeurs`) and granular permissions per resource and per action (`ViewAny:Order`, `Update:Order`, `BypassOwnership:Order`, etc.). Query-level restriction in `OrderResource::getEloquentQuery()` (a requester can only retrieve their own orders). Laravel policies covering CRUD **and** status transitions (cf. section 5). |
| **Verify compliance with the rules for using digital resources** | Automatic auditing of all sensitive actions via `owen-it/laravel-auditing` (business models + login / logout events via `Listeners/`), Eloquent filtering at query level, conditional validation (presence of a PDF quote → mandatory fields on lines), user/IP/timestamp trace per record (`audits` table). |
| **Collect, track and route requests** | **Functional core of the project**: SGI centralises supply requests issued by the school's services, routes them to the Bursar Office through an e-mail notification (`OrderCreated`) and a `Sent → Processing → Ordered → Received → Closed` workflow, with systematic notifications (`OrderStatusChanged`) to the requester on every status transition. |
| **Handle requests concerning applications** | Web application that industrialises the processing of business requests (supply orders), with explicit actions ("Process", "Mark as ordered", "Mark as received", "Close"), full audit trail, strong server-side validation, and transactional e-mails with a direct link to the order. |
| **Take part in evolving a Web site that uses the organisation's data** | Responsive Laravel/Filament web application leveraging the school's reference data (services, budgets, suppliers, categories, Zone C school holidays) and enriching it with business data (orders, lines, audits). Incremental evolution cycle over 5 sprints. |
| **Analyse the goals and organisational arrangements of a project** | Section 1 of this report: context, business problem (request dispersion, information loss, lack of traceability), functional target prioritised with the Bursar Office team, Scrum method with short sprints (1 to 2 weeks). |
| **Plan activities** | **5 dated sprints** (22 January → 25 March 2026) with a clear objective per sprint (cf. section 8), [Trello](https://trello.com/b/eIcnlMPs/application-sgi) board for the backlog and daily tracking, [Gestion_Projet_App_SGI.xlsx](/documents/E6/Gestion_Projet_App_SGI.xlsx) workbook for overall planning. |
| **Evaluate project tracking indicators and analyse deviations** | **Velocity per sprint** (15 → 23 → 29 → 30 → 19 SP delivered across 5 sprints), **workload per developer** (William 51 SP / 44 %, Luca 33 SP / 28 %, Nicolas 32 SP / 28 %), **63 tickets** across **116 SP** tracked in the Excel workbook and on Trello. |
| **Carry out integration and acceptance tests of a service** | **84 PHPUnit tests / 217 assertions** including Filament integration tests (`livewire()` helper) on the `Order`, `Budget`, `Category`, `Supplier` resources, notification tests, policy tests (28 tests on the `OrderPolicy` alone), acceptance tests via the demo mode and the `app:reset-demo` command. |
| **Deploy a service** | Reproducible **Spin Pro** environment (Docker): `spin up` provisions in a single command the application + PostgreSQL + Redis + Mailpit + Horizon. Versioned migrations, seeders for the demo dataset, `app:reset-demo` command to start over from a clean state. *(The final deployment on the school's infrastructure is covered by the dedicated portfolio project* SGI application deployment on Windows Server 2025*.)* |
| **Support users in setting up a service** | Interface fully translated into **French/English**, explicit descriptions and labels on every Filament resource, explicit state machine (every business action has a clear label and an icon), transactional e-mails with a direct link, repository [README](https://github.com/LucaBONNIN/application-sgi) and `.docs/` documentation (comparative study, development environment). The Bursar Office onboarding phase is planned for the next stage of the project. |

### 9.2 Difficulties encountered

- **Conditional validation in Filament** (mandatory fields if a PDF quote is attached): need to use `Get $get` inside the `Repeater` and to fully understand the reactive lifecycle of Livewire components.
- **Restriction of editing depending on status and role** in the `LinesRelationManager`: encoding the rule "requester if `Sent`, admin always" without duplicating the logic of the `OrderPolicy`.
- **Filament integration tests**: getting to grips with the `livewire()` *testing helper* and creating users with the right Shield roles via factories.
- **Business-day computation**: isolating the logic in a service in order to be able to unit-test it without depending on the Filament ecosystem.

### 9.3 Personal contributions

- Implementation of the **centralised state machine** on the enum (rather than duplicated in the policy or controller), a choice that paid off when writing tests.
- Design of the **role-aware form** that removes the need to have two separate screens for the requester and the administrator.
- **Conditional validation** based on the presence of the quote: business rule expressed declaratively.
- **Test suite** ensuring no regression on status transitions and permissions.

### 9.4 Limitations and outlook

- ENT authentication is not yet wired up (requires access to the school's connector).
- The "School trips" and "Theatre bookings" features will be addressed in later iterations.
- Going live on the school's infrastructure still has to be planned with the IT department.

---

## 10. Documentary appendices

| Document | Location | Content |
| --- | --- | --- |
| Comparative study and technological choices | [Link](https://github.com/LucaBONNIN/application-sgi/blob/master/.docs/Etude_Comparative_et_Choix_Technologiques.md)| Stack comparison, justification of Laravel + Filament. |
| Development environment & architecture | [Link](https://github.com/LucaBONNIN/application-sgi/blob/master/.docs/Environnement_de_Developpement_et_Architecture.md) | Spin Pro, PhpStorm, Git, code quality. |
| Eloquent models class diagram | [Link](https://raw.githubusercontent.com/LucaBONNIN/application-sgi/refs/heads/master/.docs/models_class_diagram.png) | ER view of the database. |
| Filament resources class diagram | [Link](https://raw.githubusercontent.com/LucaBONNIN/application-sgi/refs/heads/master/.docs/filament_class_diagram.svg) | Breakdown of Filament resources. |
| Sprint plan, user stories, tickets, velocity | [Link](/documents/E6/Gestion_Projet_App_SGI.xlsx) | Detailed tracking of the backlog and the workload. |
| Descriptive sheet (Annexe VII-1-B) | [Link](/documents/E6/BLONDEL_WILLIAM_ANNEXE_VII-1-B_R2.pdf) | Front / Back of the official sheet. |
