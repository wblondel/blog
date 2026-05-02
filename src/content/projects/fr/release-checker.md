---
title: "H3 Release Checker"
context: "Outil d'automatisation des contrôles avant publication d'une version du logiciel H3."
githubLink: "https://github.com/wblondel/h3-release-checker"
liveLink: "https://h3-release-checker.127011.xyz"
ficheDescriptiveLink: "/documents/E6/BLONDEL_WILLIAM_ANNEXE_VII-1-B_R1.pdf"
draft: false
coverImage: "../../../assets/projects/h3-release-checker/cover.png"
---

# Compte rendu détaillé

## 1. Contexte de l'entreprise et du projet

### 1.1 L'organisation : Horizon Trading

Horizon Trading est un éditeur de logiciels de trading professionnels destinés aux institutions financières (banques d'investissement, brokers, fonds). Son produit phare, **Horizon Market Maker 3** (H3 / *HMM3*), est une plateforme modulaire utilisée en production par de nombreux clients à travers le monde.

Le développement de H3 est organisé en **Scrum Teams** travaillant sur des sprints de deux semaines. À chaque fin de cycle, une nouvelle version (*service pack*) du logiciel est préparée, validée et livrée aux clients.

### 1.2 Le rôle de Release Manager

À chaque sprint, **une équipe Scrum joue à tour de rôle le rôle de Delivery Manager** (Release Manager) pour H3. Sa responsabilité est de **garantir la cohérence et la qualité de la prochaine version** avant qu'elle ne soit publiée.

Pour cela, il devait dérouler une **check-list manuelle** (formalisée dans le document interne *« How To Deliver a H3 Service Pack »*) qui comprenait, pour la partie *Tasks done by the delivery manager*, plus d'une dizaine de vérifications distinctes :

1. Vérifier qu'aucune *Change Request* n'est désactivée pour la release.
2. Vérifier que les versions des packages sont à jour.
3. Vérifier la complétion du *Quality Control* (QC) pour tous les tickets de la release.
4. Vérifier qu'aucun nom de client ne figure dans les tickets ET de la *release note*.
5. *Resync* manuellement tous les tickets sur le PSRV.
6. Vérifier les *fix versions* (chaque ticket doit être lié à la bonne version).
7. Identifier et corriger les tickets présents dans deux versions consécutives.
8. Vérifier la liste des packages H3 (typos, packages inconnus, etc.).
9. Re-synchroniser après chaque correction.
10. Demander un *Go / NoGo* à l'équipe QA.
11. Créer la version finale et publier.

Cette procédure était **chronophage** (de l'ordre de 30 à 45 minutes par release, et davantage en cas d'incohérences à corriger), **fastidieuse** et **sensible aux erreurs humaines**.

### 1.3 L'expression du besoin

Mon tuteur d'entreprise, en concertation avec l'équipe QA et les Release Managers, a formulé le besoin suivant :

> *« Nous voulons un outil qui, lancé automatiquement plusieurs fois par semaine et à la demande, exécute toutes les vérifications de la check-list, génère un rapport synthétique et le poste sur le canal Teams "HMM Release" en mentionnant les bonnes personnes. Le Release Manager doit pouvoir, d'un coup d'œil, savoir si la release est prête. »*

Une exigence forte est que **les contrôles soient le reflet exact de la check-list manuelle existante**, afin que le rapport de l'outil soit immédiatement compris et accepté par les équipes.

| Avant : détection visuelle des anomalies  | Avant : détection visuelle des packages obsolètes  |
|:-----------------------------------------:|:--------------------------------------------------:|
| ![CRs PSRV](../../../assets/projects/h3-release-checker/screenshots/Capture%2010.1b.png) | ![Packages obsolètes](../../../assets/projects/h3-release-checker/screenshots/Capture%2010.1.png) |

---

## 2. Présentation de l'existant et analyse préalable

### 2.1 Outils déjà en place

| Outil | Rôle | Mode d'accès |
|---|---|---|
| **Jira Cloud** | Gestion des tickets, des versions et des *fix versions* | API REST + bibliothèque Python `pycontribs/jira` |
| **PSRV** *(Packaging Server)* | Outil interne qui gère les distributions, les *change requests*, les packages, les *release notes* et la synchronisation avec un dépôt Git de packaging | API REST `httpx` + processus Java local |
| **Microsoft Teams** | Communication d'équipe, notamment le canal *HMM Release* | Webhook via Power Automate Workflow |
| **Active Directory** | Annuaire des utilisateurs (résolution UPN ↔ e-mail) | LDAP (`ldap3`) |
| **Lucca** | Gestion des absences (congés, RTT) | API REST via la bibliothèque interne `lucca` |
| **GitLab interne** | Forge de code, *issues*, CI/CD, *registry* Docker | SSH + HTTPS |
| **Microsoft Entra ID** | Authentification SSO de l'organisation | OAuth 2.0 (MSAL) |

### 2.2 Code existant

**Aucun.** Le projet a été initialisé de zéro le **17 décembre 2024**. C'est une réalisation entièrement personnelle, du *design* à la mise en production, en passant par les évolutions successives demandées par les utilisateurs.

| Une release H3 dans Jira | Custom fields utilisés sur un ticket |
|:---:|:---:|
| ![Release Jira](../../../assets/projects/h3-release-checker/screenshots/Capture%209.1.png) | ![Ticket Jira](../../../assets/projects/h3-release-checker/screenshots/Capture%209.2.png) |

### 2.3 Analyse des besoins fonctionnels

À partir de la check-list manuelle, j'ai extrait la **liste exhaustive des contrôles à automatiser** :

1. **Tickets manquants côté PSRV** : un ticket Jira marqué comme *fixVersion = `<release>`* mais absent de la *release* PSRV.
2. **Tickets manquants côté Jira** : à l'inverse, un ticket figurant dans la *release* PSRV mais sans la *fixVersion* Jira correspondante.
3. **Fix versions invalides** : un ticket dont la *fixVersion* (Jira ou PSRV) est vide, dupliquée ou ne correspond pas exactement au nom de la prochaine release.
4. **Change Requests désactivées** : présence d'une *change request* avec `disabled = true` pour la release.
5. **Packages H3 invalides** : un ticket déclare un package qui n'existe pas dans la liste des packages connus du PSRV (typos, anciens noms…).
6. **Packages obsolètes** : la version d'un package incluse dans la release n'est pas la dernière disponible (ex. : `SHORTSELL 0.16.0 (latest: 0.17.0)`).
7. **Tickets non terminés** : un ticket dont la `statusCategory` Jira n'est pas `done`.
8. **Exclusion des tickets internes** : les tickets portant le label *INTERNAL* ne doivent pas figurer dans la *release note* publique.

---

## 3. Conception et architecture de la solution

### 3.1 Vue d'ensemble

L'application est structurée en **trois grands modules** :

```
app/
├── cli/        ← Application Typer (interface ligne de commande)
│   └── main.py
├── logic/      ← Cœur métier réutilisable
│   ├── clients/        (wrappers de bibliothèques tierces : JiraClient)
│   ├── services/       (services métier : Jira, PSRV, Teams, LDAP, History, Auth, Java…)
│   ├── models/         (modèles SQLAlchemy + Pydantic Adaptive Cards)
│   ├── enums/          (JiraCustomField...)
│   ├── exceptions/     (exceptions métier)
│   ├── utils/          (logger, file_manager, path_helper...)
│   ├── config/         (settings Pydantic)
│   └── release_checker.py    (orchestrateur principal)
└── web/        ← Application NiceGUI (interface web)
    ├── main.py
    ├── middleware.py           (Entra ID auth)
    ├── auth_routes.py
    ├── components/             (ReleaseCheckForm, PsrvControl...)
    └── tabs/                   (release_check, history, latest_release, tools_management)
```

Cette séparation permet de **réutiliser** la même logique métier à la fois depuis la CLI, depuis l'interface web et depuis les tests unitaires.

### 3.2 Architecture technique

```mermaid
---
config:
  layout: elk
---
flowchart TB
    %% =====================================================
    %% USERS / ENTRY POINTS
    %% =====================================================
    subgraph users["👥 Utilisateurs & Déclencheurs"]
        direction LR
        U1["👤 Release Manager<br/>QA Team"]
        U2["⏰ cron<br/>(dashupgrade)"]
    end

    %% =====================================================
    %% PRESENTATION LAYER
    %% =====================================================
    subgraph presentation["🎨 Couche Présentation"]
        direction LR
        WEB["🌐 Web App<br/>NiceGUI / FastAPI<br/><i>app/web/</i>"]
        CLI["⌨️ CLI<br/>Typer<br/><i>app/cli/main.py</i>"]
    end

    %% =====================================================
    %% AUTH MIDDLEWARE
    %% =====================================================
    AUTH["🔒 EntraAuthMiddleware<br/><i>middleware.py</i>"]

    %% =====================================================
    %% LOGIC / BUSINESS LAYER
    %% =====================================================
    subgraph logic["🧠 Couche Logique Métier (app/logic/)"]
        direction TB
        ORCH["🎯 ReleaseChecker<br/><i>release_checker.py</i><br/>Orchestrateur principal"]

        subgraph services["Services"]
            direction LR
            S_JIRA["JiraService"]
            S_PSRV["PsrvService"]
            S_LDAP["LdapService"]
            S_TEAMS["TeamsService"]
            S_HIST["HistoryService"]
            S_AUTH["AuthService<br/>(MSAL)"]
            S_JAVA["JavaService"]
            S_REPORT["ReleaseReport<br/>Generator"]
        end

        subgraph models["Modèles"]
            direction LR
            M_EXEC["ExecutionRecord<br/>(SQLAlchemy)"]
            M_CARD["TeamsCard<br/>(Pydantic)"]
            M_TICKET["TicketSummary<br/>(dataclass)"]
        end
    end

    %% =====================================================
    %% PERSISTENCE
    %% =====================================================
    DB[("💾 SQLite<br/>history.db")]

    %% =====================================================
    %% EXTERNAL SYSTEMS
    %% =====================================================
    subgraph external["🌍 Systèmes externes"]
        direction TB
        EXT_JIRA["📋 Jira Cloud<br/>REST API"]
        EXT_PSRV["📦 PSRV<br/>(processus Java +<br/>API REST + Git)"]
        EXT_AD["🏢 Active Directory<br/>(LDAP)"]
        EXT_LUCCA["📅 Lucca<br/>(API absences)"]
        EXT_TEAMS["💬 Power Automate<br/>→ MS Teams"]
        EXT_ENTRA["🔑 Microsoft Entra ID<br/>(OAuth 2.0)"]
        EXT_AZUL["☕ Azul Zulu JDK<br/>(metadata API)"]
    end

    %% =====================================================
    %% FLOWS
    %% =====================================================
    U1 --> WEB
    U2 --> CLI

    WEB --> AUTH
    AUTH --> WEB
    AUTH -.OAuth.-> EXT_ENTRA

    WEB --> ORCH
    CLI --> ORCH

    ORCH --> S_JIRA
    ORCH --> S_PSRV
    ORCH --> S_LDAP
    ORCH --> S_TEAMS
    ORCH --> S_HIST
    ORCH --> S_JAVA
    ORCH --> S_REPORT

    S_JIRA --> EXT_JIRA
    S_PSRV --> EXT_PSRV
    S_LDAP --> EXT_AD
    S_TEAMS -.via Lucca.-> EXT_LUCCA
    S_TEAMS --> EXT_TEAMS
    S_AUTH --> EXT_ENTRA
    S_JAVA --> EXT_AZUL

    S_HIST --> M_EXEC
    M_EXEC --> DB

    S_REPORT --> M_TICKET
    S_TEAMS --> M_CARD

    %% =====================================================
    %% STYLING
    %% =====================================================
    classDef user fill:#FBEA5A,stroke:#b8860b,stroke-width:2px,color:#000
    classDef presentation fill:#65A8EE,stroke:#1e88e5,stroke-width:2px,color:#000
    classDef logic fill:#42F23F,stroke:#2e7d32,stroke-width:2px,color:#000
    classDef external fill:#F6706C,stroke:#c62828,stroke-width:2px,color:#000
    classDef db fill:#CA76FA,stroke:#6a1b9a,stroke-width:2px,color:#000
    classDef auth fill:#F8BF5B,stroke:#e65100,stroke-width:2px,color:#000

    class U1,U2 user
    class WEB,CLI presentation
    class ORCH,S_JIRA,S_PSRV,S_LDAP,S_TEAMS,S_HIST,S_AUTH,S_JAVA,S_REPORT,M_EXEC,M_CARD,M_TICKET logic
    class EXT_JIRA,EXT_PSRV,EXT_AD,EXT_LUCCA,EXT_TEAMS,EXT_ENTRA,EXT_AZUL external
    class DB db
    class AUTH auth
```

**Légende**

- **🟡 Utilisateurs & Déclencheurs** : qui ou quoi déclenche un contrôle de release.
- **🔵 Couche Présentation** : interfaces utilisateur (web NiceGUI ou CLI Typer).
- **🟠 Middleware d'authentification** : protège l'interface web (deny by default).
- **🟢 Couche Logique Métier** : services réutilisables, modèles de données, orchestrateur central.
- **🟣 Persistance** : base de données SQLite locale (historique des exécutions).
- **🔴 Systèmes externes** : APIs et services tiers consommés par l'application.



### 3.3 Choix technologiques justifiés

| Choix | Justification |
|---|---|
| **Python 3.13** | Langage déjà utilisé dans d'autres outils internes ; large écosystème (Jira, MSAL, ldap3, SQLAlchemy, NiceGUI). |
| **Poetry 2** | Gestion déterministe des dépendances, *lockfile*, *groups* de dépendances dev/prod, packaging facile. |
| **Typer** | Construction très rapide d'une CLI propre à partir de simples annotations de type Python. |
| **NiceGUI (sur FastAPI)** | Permet d'écrire un frontend web réactif **entièrement en Python** sans devoir développer un client React/Vue séparé. Idéal pour un outil interne maintenu par une seule personne. |
| **Pydantic + Pydantic Settings** | Validation et sérialisation typées (utilisée à la fois pour les *Adaptive Cards* et pour la configuration via variables d'environnement). |
| **SQLAlchemy 2.0 + SQLite** | ORM mature, pas de serveur de base de données à administrer ; SQLite suffit largement pour le volume d'historique d'un outil interne. |
| **httpx (async)** | Client HTTP asynchrone, indispensable pour paralléliser les appels à Jira et au PSRV (ce qui réduit nettement le temps total d'exécution). |
| **MSAL Python** | Bibliothèque officielle Microsoft pour l'authentification Entra ID en flux *Authorization Code*. |
| **Docker multi-stage** | Image de production minimale, image de développement avec hot-reload, build d'examen *offline* (`Dockerfile.exam`) sans réseau interne. |
| **Ruff** | *Linter* + formateur ultra-rapide, preset `ALL` pour un niveau d'exigence maximal. |
| **pytest** | Standard de fait des tests Python, asynchrone supporté via `pytest-asyncio`. |

### 3.4 Modèle de données : table `executions`

#### 3.4.1 Modèle mono-table
L'application persiste l'historique des exécutions dans une base **SQLite locale** gérée via l'ORM **SQLAlchemy 2.0**. Le schéma est volontairement simple : **une seule table `executions`**, dans laquelle les champs complexes (rapport et logs) sont sérialisés en JSON dans des colonnes `TEXT`.

**Pourquoi un modèle "mono-table avec JSON" ?**

| Choix | Justification |
|---|---|
| **Une seule table** | L'application est mono-utilisateur côté écriture (cron + clics ponctuels). Aucun besoin de jointures complexes. |
| **`report_summary` en JSON** | Le contenu du rapport (statistiques, tableau ticket par ticket, regroupement par assigné) est **opaque** au moteur SQL : il n'est jamais filtré ni agrégé en SQL, il sert uniquement à l'affichage du détail d'une exécution. |
| **`logs` en JSON** | Idem : les logs d'une exécution sont consultés en bloc dans la vue détail, jamais cherchés ligne par ligne. |
| **Index sur `timestamp` et `status`** | Ces deux colonnes sont les seules utilisées dans les filtres de la vue *History* (tri par date, filtre par statut). |
| **`id` en `String(36)`** | UUID v4 généré côté Python, passé tel quel à Power Automate pour permettre le *deep-link* `?tab=history&id=<uuid>` depuis la notification Teams. |

```mermaid
erDiagram
    EXECUTIONS {
        string(36) id PK "UUID v4 - généré côté Python"
        string(50) timestamp "ISO 8601 - INDEX"
        string(20) project_key "Ex: ET"
        string(100) release_name "Ex: H3-2026.04"
        string(20) status "success | partial | error - INDEX"
        text report_summary_json "JSON sérialisé"
        text logs_json "JSON sérialisé (liste de strings)"
        float duration_seconds "Durée en secondes (nullable)"
    }
```
*<p align="center">Diagramme ER de la table `executions`</p>*

Les statuts `success` / `partial` / `error` permettent de distinguer :
- `success` : tout s'est bien passé.
- `partial` : le rapport a été généré et persisté, mais l'envoi à Teams a échoué (par exemple Power Automate indisponible). Le rapport reste consultable dans l'historique.
- `error` : une exception est remontée avant que le rapport n'ait pu être généré. La trace est sauvegardée pour analyse.

#### 3.4.2 Structure du rapport
Bien que SQLAlchemy ne voie qu'un blob `TEXT`, la structure interne du `report_summary_json` est elle-même **fortement typée côté Python** (via les *dataclasses* `TicketSummary` et `ReportContext`).

Voici sa décomposition logique :

```mermaid
erDiagram
    EXECUTIONS ||--|| REPORT_SUMMARY : contient
    EXECUTIONS ||--o{ LOG_LINES : contient

    REPORT_SUMMARY ||--o{ TICKET_SUMMARY : "tickets_summary"
    REPORT_SUMMARY ||--o{ ASSIGNEE_BUCKET : "tickets_by_assignee"

    EXECUTIONS {
        string id PK "UUID"
        string timestamp "ISO 8601"
        string project_key
        string release_name
        string status "success/partial/error"
        text report_summary_json "JSON"
        text logs_json "JSON"
        float duration_seconds
    }

    REPORT_SUMMARY {
        int tickets_count
        int unready_tickets_count
        int invalid_h3_pkgs_count
        int missing_psrv_count
        int missing_jira_count
        string teams_error "présent si status=partial"
        string error "présent si status=error"
    }

    TICKET_SUMMARY {
        string ticket_id PK "Ex: ET-12345"
        json   assignee "{displayName, emailAddress, key}"
        string reporter
        json   status "{name, statusCategory.key}"
        string product_owner
        string qc_assignee
        string code_reviewer
        json   fix_versions_jira
        json   fix_versions_psrv
        bool   fix_version_status_jira
        bool   fix_version_status_psrv
        string h3_build
        json   h3_packages_jira
        json   h3_packages_psrv
        json   h3_invalid_packages_psrv
        bool   h3_packages_status_jira
        bool   h3_packages_status_psrv
        bool   is_on_psrv
        bool   is_on_jira
        bool   is_in_both
        bool   has_disabled_cr
        bool   is_ok
    }

    ASSIGNEE_BUCKET {
        string assignee_display_name PK
        json   missing_psrv "List[ticket_id]"
        json   missing_jira "List[ticket_id]"
        json   invalid_fix_versions
        json   disabled_change_requests
        json   invalid_h3_packages
        json   unready
    }

    LOG_LINES {
        int line_number
        string content
    }
```
*<p align="center">Structure interne du JSON stocké dans `report_summary_json` et `logs_json`</p>*

#### 3.4.3 Cycle de vie d'une ligne `executions`
Le cycle de vie d'une ligne `executions` est le suivant :
```mermaid
stateDiagram-v2
    [*] --> en_cours : ReleaseChecker.check_async()
    en_cours --> success : Rapport généré + Teams OK
    en_cours --> partial : Rapport généré + Teams KO
    en_cours --> error : Exception avant génération
    success --> [*]
    partial --> [*]
    error --> [*]

    note right of partial
        Le rapport est sauvegardé
        AVANT l'envoi Teams
        pour garantir la persistance
    end note

    note right of error
        Trace d'exception persistée
        dans report_summary.error
    end note
```

#### 3.4.4 Volumétrie estimée

| Champ | Taille typique | Commentaire |
|---|---|---|
| `id` | 36 octets | UUID v4 fixe |
| `timestamp` | ~26 octets | ISO 8601 avec microsecondes |
| `project_key` | 2 à 20 octets | Ex: `ET` |
| `release_name` | ~10 à 15 octets | Ex: `H3-2026.04` |
| `status` | 5 à 7 octets | Énum |
| `report_summary_json` | **5 à 50 Ko** | Dépend du nombre de tickets dans la release (50 à 300 tickets en pratique) |
| `logs_json` | **2 à 10 Ko** | ~50 à 200 lignes de logs par exécution |
| `duration_seconds` | 8 octets | Float |

À raison d'environ **3 exécutions par semaine** (cron) et de quelques exécutions manuelles, la base atteint à peine **quelques mégaoctets sur une année complète** : SQLite est largement dimensionné pour ce besoin.

### 3.5 Sécurité et authentification

L'interface web est protégée par un **middleware Starlette** (`app/web/middleware.py`) qui applique le principe **« deny by default »** :

- Toutes les routes nécessitent une session utilisateur valide (`app.storage.user["auth"]`).
- Une liste blanche très restreinte autorise les routes publiques nécessaires au flux OAuth : `/login`, `/auth/callback`, `/logout`, `/logged-out`, `/access-denied` et les ressources statiques NiceGUI (`/_nicegui/`, `/static/`).

Le service d'authentification (`app/logic/services/auth.py`) :

1. Génère l'URL d'autorisation Entra ID via MSAL (`get_authorization_request_url`).
2. À la réception du *callback*, échange le code d'autorisation contre un *access token* + *id token* (`acquire_token_by_authorization_code`).
3. Extrait les *claims* (`name`, `preferred_username`, `groups`) du *id token*.
4. Mappe les `groups` (object IDs Entra ID) sur deux rôles applicatifs :
   - `readwrite` (groupe `ENTRA_READWRITE_GROUP_ID`)
   - `read` (groupe `ENTRA_READ_GROUP_ID`)
5. Si l'utilisateur n'appartient à aucun groupe autorisé, il est redirigé vers la page `/access-denied`.

L'application web réagit ensuite au rôle :

- Un utilisateur `read` ne voit que l'onglet **History** (consultation seule).
- Un utilisateur `readwrite` voit tous les onglets et peut déclencher des contrôles, supprimer des entrées d'historique, etc.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 Utilisateur
    participant Browser as 🌐 Navigateur
    participant Mid as 🔒 EntraAuthMiddleware
    participant App as 🎨 NiceGUI App
    participant Auth as 🔑 AuthService<br/>(MSAL)
    participant Entra as ☁️ Microsoft Entra ID

    User->>Browser: Ouvre /
    Browser->>+Mid: GET /
    Mid->>Mid: Vérifier app.storage.user["auth"]
    alt Pas de session
        Mid-->>Browser: 302 Location: /login
        Browser->>+App: GET /login
        App->>+Auth: get_auth_url(redirect_uri)
        Auth->>Auth: get_authorization_request_url(<br/>scopes=[User.Read])
        Auth-->>-App: URL Microsoft
        App-->>-Browser: 302 vers Microsoft
        Browser->>+Entra: Login Microsoft
        User->>Entra: Saisit identifiants + MFA
        Entra-->>-Browser: 302 /auth/callback?code=...
        Browser->>+App: GET /auth/callback?code=...
        App->>+Auth: exchange_code(code, redirect_uri)
        Auth->>+Entra: acquire_token_by_authorization_code()
        Entra-->>-Auth: id_token + access_token
        Auth->>Auth: Décodage des claims<br/>(name, email, groups)
        Auth->>Auth: extract_role(groups)
        Auth-->>-App: {name, email, groups, role}
        alt role == None (aucun groupe autorisé)
            App->>App: storage.user["auth"] = info<br/>(pour contexte)
            App-->>Browser: redirect /access-denied
            Browser-->>User: 🚫 Accès refusé
        else role in [read, readwrite]
            App->>App: storage.user["auth"] = info
            App-->>-Browser: redirect /
            Browser->>Mid: GET /
            Mid->>Mid: ✅ Session OK
            Mid->>App: pass through
            App-->>Browser: Page d'accueil
            Browser-->>User: ✨ Application
        end
    else Session valide
        Mid-->>-Browser: pass through
        Browser-->>User: ✨ Application
    end

    Note over User,Entra: Pour la déconnexion :<br/>/logout → vide la session<br/>→ Microsoft logout endpoint<br/>→ /logged-out
```
*<p align="center">Diagramme du flux OAuth 2.0</p>*

```mermaid
flowchart LR
    G1["👥 Groupe Entra ID<br/>readwrite_group_id"] --> R1["🔓 Rôle: readwrite"]
    G2["👥 Groupe Entra ID<br/>read_group_id"] --> R2["📖 Rôle: read"]
    G3["❌ Aucun groupe"] --> R3["🚫 Rôle: None<br/>→ /access-denied"]

    R1 --> T1["✅ Tous les onglets<br/>✅ Run check<br/>✅ Delete history"]
    R2 --> T2["✅ Onglet History uniquement<br/>📖 Lecture seule"]

    classDef rw fill:#d6f5d6,stroke:#2e7d32,color:#000
    classDef ro fill:#fff4d6,stroke:#b8860b,color:#000
    classDef no fill:#f5d6d6,stroke:#c62828,color:#000

    class G1,R1,T1 rw
    class G2,R2,T2 ro
    class G3,R3 no
```
*<p align="center">Mapping des rôles</p>*

| Page Microsoft de connexion | En-tête authentifié + rôle |
|:---:|:---:|
| ![Login Microsoft](../../../assets/projects/h3-release-checker/screenshots/Capture%205.1.png) | ![En-tête authentifié](../../../assets/projects/h3-release-checker/screenshots/Capture%205.2.png) |

| Page *Access Denied* (aucun groupe) | Page *Logged Out* |
|:---:|:---:|
| ![Access Denied](../../../assets/projects/h3-release-checker/screenshots/Capture%205.3.png) | ![Logged Out](../../../assets/projects/h3-release-checker/screenshots/Capture%205.4.png) |

---

## 4. Détail des fonctionnalités

Ce diagramme illustre **le déroulé complet** d'une exécution de la commande `releases check` (depuis l'interface web ou la CLI), depuis le clic utilisateur jusqu'à la notification Microsoft Teams. Il met en évidence la **parallélisation asynchrone** entre la récupération du contexte Jira et le démarrage du PSRV grâce à `asyncio.gather`.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 Release Manager
    participant Web as 🌐 NiceGUI Web
    participant Mid as 🔒 EntraAuthMiddleware
    participant RC as 🎯 ReleaseChecker
    participant Java as ☕ JavaService
    participant Jira as 📋 JiraService
    participant PSRV as 📦 PsrvService
    participant Report as 📊 ReportGenerator
    participant Hist as 💾 HistoryService
    participant DB as 🗄️ SQLite
    participant Lucca as 📅 Lucca
    participant LDAP as 🏢 LDAP/AD
    participant Teams as 💬 Teams (Power Automate)

    User->>+Web: GET /
    Web->>+Mid: Vérifier session
    alt Pas de session
        Mid-->>Web: 302 /login
        Web-->>User: Redirection Entra ID
        User->>Web: OAuth2 callback (code)
        Web->>Web: exchange_code() / extraction rôle
    end
    Mid-->>-Web: ✅ Authentifié
    Web-->>-User: Page (onglets selon rôle)

    User->>+Web: Clic "Run Check"
    Web->>+RC: check_async()

    Note over RC: Génération execution_id (UUID)

    Note over RC,Java: Phase 1 - Mise à jour outils (séquentiel)
    RC->>+Java: update_java()
    Java-->>-RC: chemin JDK
    RC->>+PSRV: update_psrv()
    PSRV-->>-RC: chemin psrv.jar

    Note over RC,PSRV: Phase 2 - Parallélisation asyncio.gather
    par Récupération Jira
        RC->>+Jira: get_next_release(project, prefix)
        Jira-->>-RC: next_release
        RC->>+Jira: get_issues_in_release()
        Jira-->>-RC: liste des tickets
    and Démarrage PSRV
        RC->>+PSRV: start() + wait_for_health()
        PSRV-->>-RC: PID + health OK
    end

    Note over RC,PSRV: Phase 3 - Interactions PSRV
    RC->>+PSRV: login()
    PSRV-->>-RC: session httpx
    RC->>PSRV: reset_repo() + pull_repo()
    RC->>PSRV: sync_tickets(distribution, release)
    RC->>+PSRV: get_release_info()
    PSRV-->>-RC: psrv_release_info
    RC->>+PSRV: create_dummy_cr()
    PSRV-->>-RC: dummy_cr
    RC->>+PSRV: get_repo_info()
    PSRV-->>-RC: psrv_repo
    RC->>RC: find_outdated_packages(dummy_cr, repo)
    RC->>PSRV: delete_cr(dummy_cr)
    RC->>PSRV: stop()

    Note over RC,Report: Phase 4 - Génération du rapport
    RC->>+Report: generate_tickets_summary(context)
    Report-->>-RC: PrettyTable + List[TicketSummary]
    RC->>+Report: analyze_tickets_by_assignee()
    Report-->>-RC: dict tickets par assigné

    Note over RC,DB: Phase 5 - Persistance prioritaire
    RC->>+Hist: save_execution(status="success")
    Hist->>+DB: INSERT/UPDATE executions
    DB-->>-Hist: OK
    Hist-->>-RC: execution_id

    Note over RC,Teams: Phase 6 - Notification Teams (best-effort)
    RC->>+Lucca: retrieve_between(today, today)
    Lucca-->>-RC: liste des absents

    loop Pour chaque assigné concerné
        RC->>+LDAP: get_users_by_email(emailAddress)
        LDAP-->>-RC: UPN
        alt Assigné absent
            RC->>RC: Bascule vers QC assignee + Code reviewer
        end
        RC->>RC: create_mention_entity(displayName, UPN)
    end

    RC->>RC: create_message(adaptive cards)
    RC->>+Teams: POST workflow Power Automate
    alt Envoi OK
        Teams-->>RC: 200 OK
    else Échec Teams
        Teams-->>-RC: ❌ Erreur
        RC->>Hist: save_execution(status="partial")
        Hist->>DB: UPDATE
    end

    RC-->>-Web: PrettyTable + report
    Web-->>-User: ✅ "Check completed"
    Note over User,Teams: Notification Teams visible<br/>sur le canal HMM Release
```

Les six phases sont les suivantes :

1. **Phase 1** : Mise à jour des outils (Java, PSRV) en séquentiel.
2. **Phase 2** : Parallélisation `asyncio.gather` : pendant que le PSRV démarre, les données Jira sont récupérées en parallèle.
3. **Phase 3** : Interactions HTTP avec l'API REST du PSRV : reset/pull du repo, *resync*, création/suppression d'une CR fictive pour détecter les packages obsolètes.
4. **Phase 4** : Génération du tableau récapitulatif et des regroupements par assigné.
5. **Phase 5** : Persistance immédiate du rapport en base **avant** d'essayer la notification Teams (pour ne jamais perdre un rapport en cas d'échec d'envoi).
6. **Phase 6** : Envoi de la notification Microsoft Teams via Power Automate, avec résolution UPN par LDAP, prise en compte des absences via Lucca, et mécanisme de **fallback `partial`** si l'envoi échoue.

Ce diagramme présente l'**arbre de décision** appliqué à chaque ticket lors d'un release check, ainsi que les anomalies remontées dans le rapport.

```mermaid
flowchart TB
    START([🎟️ Pour chaque ticket de la release]) --> Q1{Présent<br/>côté Jira ?}

    Q1 -- Non --> A1["⚠️ MISSING JIRA<br/>(uniquement dans PSRV)"]
    Q1 -- Oui --> Q2{Présent<br/>côté PSRV ?}

    Q2 -- Non --> A2["⚠️ MISSING PSRV<br/>(uniquement dans Jira)"]
    Q2 -- Oui --> Q3{Status Jira<br/>= done ?}

    Q3 -- Non --> A3["⏳ UNREADY<br/>statut KO"]
    Q3 -- Oui --> Q4{Fix version<br/>Jira valide ?}

    Q4 -- Non --> A4["❌ INVALID FV<br/>(Jira)"]
    Q4 -- Oui --> Q5{Fix version<br/>PSRV valide ?}

    Q5 -- Non --> A5["❌ INVALID FV<br/>(PSRV)"]
    Q5 -- Oui --> Q6{Cité dans une<br/>Disabled CR ?}

    Q6 -- Oui --> A6["🚫 DISABLED CR"]
    Q6 -- Non --> Q7{Tous les packages H3<br/>sont connus ?}

    Q7 -- Non --> A7["📦 INVALID H3 PKGS<br/>(typo, ancien nom...)"]
    Q7 -- Oui --> Q8{Versions des packages<br/>= latest ?}

    Q8 -- Non --> A8["📦 OUTDATED PKGS<br/>(non bloquant)"]
    Q8 -- Oui --> OK([✅ TICKET OK])

    A1 --> REPORT[(📊 Ajouté au rapport<br/>+ regroupé par assigné)]
    A2 --> REPORT
    A3 --> REPORT
    A4 --> REPORT
    A5 --> REPORT
    A6 --> REPORT
    A7 --> REPORT
    A8 --> REPORT
    OK --> REPORT

    REPORT --> NOTIF{Notification<br/>Teams ?}
    NOTIF -- Oui --> MENTION["@mention l'assigné<br/>(via LDAP→UPN)"]
    MENTION --> ABSENT{Assigné<br/>en congés ?<br/>}
    ABSENT -- Oui --> SUB["@mention QC assignee<br/>+ Code reviewer"]
    ABSENT -- Non --> SEND[💬 Envoi Teams]
    SUB --> SEND

    classDef errorClass fill:#ffd6d6,stroke:#c62828,color:#000
    classDef warnClass fill:#fff4d6,stroke:#b8860b,color:#000
    classDef okClass fill:#d6f5d6,stroke:#2e7d32,color:#000
    classDef qClass fill:#d6e9ff,stroke:#1e88e5,color:#000

    class A1,A2,A4,A5,A6,A7 errorClass
    class A3,A8 warnClass
    class OK okClass
    class Q1,Q2,Q3,Q4,Q5,Q6,Q7,Q8 qClass
```

Les anomalies sont de plusieurs types :

| Catégorie | Sévérité | Description |
|---|---|---|
| **MISSING PSRV** | 🔴 Bloquant | Le ticket Jira a la bonne *fixVersion* mais n'est pas dans la release PSRV. |
| **MISSING JIRA** | 🔴 Bloquant | Le ticket figure dans la release PSRV mais n'a pas la *fixVersion* Jira correspondante. |
| **INVALID FV** | 🔴 Bloquant | La *fixVersion* Jira ou PSRV est vide, dupliquée, ou pointe sur une autre release. |
| **DISABLED CR** | 🔴 Bloquant | Le ticket est rattaché à une *change request* désactivée. |
| **INVALID H3 PKGS** | 🔴 Bloquant | Au moins un des packages déclarés sur le ticket n'est pas connu du PSRV (typo). |
| **UNREADY** | 🟡 À surveiller | Le statut Jira n'est pas en `done` (ex. : *In Progress*, *In Review*). |
| **OUTDATED PKGS** | 🟡 Informatif | Un package est en production avec une version inférieure à la dernière disponible (info, non bloquant). |


### 4.1 Commande CLI `releases check`

```text
Usage: my-cli releases check [OPTIONS]

 Check release.

 Raises:
 typer.Exit: If an error occurs during the release check.

╭─ Options ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ --project-key          -p       TEXT  Project key [default: ET]                                                                       │
│ --release-prefix       -r       TEXT  Release prefix [default: H3]                                                                    │
│ --release                       TEXT  Release to check. If none is provided, the latest will be determined automatically.             │
│ --[no]-stop-psrv                      Stop the PSRV after checks are done. [default: stop-psrv]                                       │
│ --[no]-start-psrv                     Start the PSRV before doing the checks. [default: start-psrv]                                   │
│ --[no]-hard-reset-repo                Hard reset the repo before doing the checks. [default: hard-reset-repo]                         │
│ --[no]-update-tools                   Update the tools before doing the checks. [default: update-tools]                               │
│ --[no]-resync-tickets                 Resync all tickets before doing the checks. [default: resync-tickets]                           │
│ --[no]-push-commit                    Push the 'Refresh tickets' commit after synchronization. [default: no-push-commit]              │
│ --reply-to-message-id           TEXT  ID of the Teams Channel Message ID to reply to.                                                 │
│ --[no]-show-done-each-step            On each step, write 'Done!' at the end of line when done. [default: no-show-done-each-step]     │
│ --help                                Show this message and exit.                                                                     │
╰───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

C'est cette commande qui est appelée depuis le **cron** sur le serveur `dashupgrade`. Elle peut également être utilisée par les développeurs.

| Aide générale `--help` | Aide de `releases check` |
|:---:|:---:|
| ![CLI help](../../../assets/projects/h3-release-checker/screenshots/Capture%207.1.png) | ![CLI releases check help](../../../assets/projects/h3-release-checker/screenshots/Capture%207.2.png) |

| Exécution réussie en CLI (PrettyTable) | Gestion des outils |
|:---:|:---:|
| ![CLI execution](../../../assets/projects/h3-release-checker/screenshots/Capture%207.3.png) | ![CLI tools commands](../../../assets/projects/h3-release-checker/screenshots/Capture%207.4.png) |

### 4.2 Le moteur de comparaison

Le cœur métier est implémenté dans [**`ReleaseReportGenerator.generate_tickets_summary()`**](https://github.com/wblondel/h3-release-checker/app/logic/services/release_report.py). Il prend en entrée un `ReportContext` contenant les tickets Jira de la release, les tickets PSRV de la release, les *change requests* désactivées et la liste des packages connus, et produit pour chaque ticket un objet `TicketSummary` contenant tous les champs nécessaires à l'affichage : statut, *fix versions* Jira et PSRV, packages, *flags* d'incohérence, etc.

L'algorithme :

1. Pour chaque ticket Jira de la release :
   - Vérifier s'il est aussi présent dans la release PSRV.
   - Vérifier s'il est cité dans une *change request* désactivée.
   - Récupérer la *fix version* PSRV correspondante.
   - Comparer les packages H3 déclarés au niveau du ticket avec les `packageRules` de la release PSRV.
   - Marquer comme **invalide** tout package qui n'apparaît dans aucune des règles.
2. Calculer pour chaque ticket les booléens : `is_in_both`, `has_disabled_cr`, `is_ok` (vert si tout est bon).
3. Construire un `PrettyTable` avec un *custom format* par colonne (`Y` / `N` / `N/A` pour les booléens, *display name* pour les *Jira Users*, etc.).

Une seconde méthode, **`analyze_tickets_by_assignee()`**, regroupe les anomalies par assigné, ce qui permet à la notification Teams de mentionner directement les bonnes personnes plutôt que de leur faire parcourir une longue liste.

### 4.3 Interaction avec le PSRV

Le service [`PsrvService`](https://github.com/wblondel/h3-release-checker/app/logic/services/psrv.py) gère le cycle de vie complet du processus PSRV :

1. **Téléchargement** du JAR le plus récent depuis l'artifactory interne.
2. **Démarrage** du processus Java avec et toutes les options nécessaires.
3. **Attente de la disponibilité** via une *health check* HTTP.
4. **Authentification** sur l'API REST.
5. **Exécution des opérations** : reset du repo, pull, *resync* des tickets, récupération des informations de release et du repo, création/suppression d'une *change request* fictive (utilisée pour détecter les packages obsolètes).
6. **Arrêt propre** du processus en lisant le PID file produit par le PSRV.

L'utilisation systématique de `httpx.AsyncClient` permet de **paralléliser** la récupération du contexte Jira et le démarrage du PSRV (qui prend plusieurs dizaines de secondes), via `asyncio.gather`. Cela réduit notablement le temps total d'exécution.

### 4.4 La notification Microsoft Teams (Adaptive Cards + Power Automate)

J'ai modélisé l'intégralité de l'Adaptive Card en [Pydantic](https://github.com/wblondel/h3-release-checker/app/logic/models/teams_card.py). Le `TeamsService.create_message()` produit un `TeamsMessage` constitué de **trois cartes attachées** :

1. **Carte principale** : avatar + nom de la release + date de début + description + `FactSet` (compteurs : `Tickets missing in PSRV`, `Invalid FV`, `Disabled CRs`, `Outdated pkgs`, `Invalid H3 pkgs`, `Unready tickets`) + bloc de personnes mentionnées + boutons d'action.
2. **Carte tableau** : un *Table* `Adaptive Card` qui liste, par assigné, les tickets concernés par chaque type d'anomalie.
3. **Carte « reply »** : si un `parentMessageId` Teams a été passé en paramètre, la nouvelle notification est postée en *réponse* à un message existant, ce qui permet de *threader* l'historique des contrôles d'une même release.

Le payload est ensuite POSTé sur un **workflow Power Automate** dont l'URL et la signature sont configurées par variables d'environnement (`TEAMS_WORKFLOW_HOST`, `TEAMS_WORKFLOW_ID`, `TEAMS_WORKFLOW_SIGNATURE`). Le flow Power Automate reçoit le payload et le poste sur le canal Teams.

#### Le système de mentions intelligentes

Pour qu'une mention `@Nom` soit cliquable sur Teams, il faut connaître l'**UPN** (User Principal Name) de la personne, pas seulement son nom. Or Jira ne fournit que l'adresse e-mail. La résolution se fait donc en plusieurs étapes :

1. Pour chaque assigné concerné par une anomalie, récupérer son `emailAddress` depuis Jira.
2. Interroger l'**Active Directory** via LDAP (`LdapService.get_users_by_email()`) pour obtenir l'`userPrincipalName`.
3. Si l'UPN est trouvé, créer une `MentionEntity` Adaptive Card.
4. **Si l'assigné est en congés** (information récupérée via l'API Lucca avec la bibliothèque interne `lucca`), basculer la mention sur les **QC assignee** et **code reviewer** (récupérés via les *custom fields* Jira `JiraCustomField.QC_ASSIGNEE` et `JiraCustomField.CODE_REVIEWER`).

Cette logique évite de spammer une personne absente et permet de faire avancer le ticket avec son backup.

| Adaptive Card principale | Tableau par assigné |
|:---:|:---:|
| ![Carte principale](../../../assets/projects/h3-release-checker/screenshots/Capture%206.1.png) | ![Tableau par assigné](../../../assets/projects/h3-release-checker/screenshots/Capture%206.2.png) |

| Réponse en *thread* |
|:---:|
| ![Reply en thread](../../../assets/projects/h3-release-checker/screenshots/Capture%206.3.png) |

| Flux Power Automate | Détail d'une exécution réussie du flux |
|:---:|:---:|
| ![Power Automate flow](../../../assets/projects/h3-release-checker/screenshots/Capture%208.1.png) | ![Power Automate execution](../../../assets/projects/h3-release-checker/screenshots/Capture%208.2.png) |

### 4.5 Interface web

L'application web NiceGUI propose **quatre onglets** :

#### 4.5.1 Release Check

- Formulaire de configuration (clé projet, préfixe, release optionnelle, *Reply to Message ID*).
- Boutons bascule pour activer/désactiver chaque étape.
- **Détection automatique** : si on colle une URL Teams dans le champ *Reply To Message ID*, l'application en extrait le `parentMessageId` automatiquement.
- **Journal en direct** : la sortie du `ReleaseChecker` est *streamée* dans en bas du formulaire.

| Formulaire vide (état initial) | Exécution en cours (logs en direct) |
|:---:|:---:|
| ![Formulaire vide](../../../assets/projects/h3-release-checker/screenshots/Capture%201.1.png) | ![Exécution en cours](../../../assets/projects/h3-release-checker/screenshots/Capture%201.2.png) |

| Exécution terminée avec succès |
|:---:|
| ![Exécution terminée](../../../assets/projects/h3-release-checker/screenshots/Capture%201.3.png) |

#### 4.5.2 Get Latest Release

- Petit utilitaire qui interroge Jira pour afficher la prochaine release (utile au Release Manager pour vérifier rapidement).

| Affichage de la prochaine release |
|:---:|
| ![Get Latest Release](../../../assets/projects/h3-release-checker/screenshots/Capture%202.1.png) |

#### 4.5.3 Tools Management

- Boutons pour démarrer / arrêter le PSRV manuellement (utile en debug) et déclencher la mise à jour de Java et du PSRV.

| Onglet *Tools Management* |
|:---:|
| ![Tools Management](../../../assets/projects/h3-release-checker/screenshots/Capture%203.1.png) |

#### 4.5.4 History

- Liste paginée des exécutions avec :
  - filtres par **statut** et par **release** ;
  - badges colorés (vert / orange / rouge) selon le statut ;
  - boutons *View report* et *Delete* ;
  - bouton *Clear All* (lecture-écriture uniquement) ;
  - **rafraîchissement automatique** toutes les 2 secondes (uniquement quand on est sur la liste, pas dans le détail).
- Vue détaillée d'une exécution :
  - en-tête (release, projet, statut, durée, date) ;
  - bouton **Export JSON** pour télécharger le rapport ;
  - 4 cartes statistiques (tickets totaux, *missing PSRV*, *invalid pkgs*, *unready*) ;
  - tableau **« Actionable Items by Assignee »** ;
  - tableau ticket par ticket avec liens Jira cliquables et icônes visuelles (✓ vert / ⚠ rouge) ;
  - panneau des journaux d'exécution dépliable.
- Si le statut est `error`, la vue affiche directement la trace de l'exception et les logs (court-circuit du reste).
- Si le statut est `partial`, un bandeau orange explique que le rapport a bien été généré mais que la notification Teams a échoué, et donne accès au détail de l'erreur.

| Liste paginée (statuts mélangés, filtres) | Vue détaillée — statut `success` |
|:---:|:---:|
| ![History list](../../../assets/projects/h3-release-checker/screenshots/Capture%204.1.png) | ![History detail success](../../../assets/projects/h3-release-checker/screenshots/Capture%204.2.png) |

| Vue détaillée — statut `partial` | Vue détaillée — statut `error` |
|:---:|:---:|
| ![History detail partial](../../../assets/projects/h3-release-checker/screenshots/Capture%204.3.png) | ![History detail error](../../../assets/projects/h3-release-checker/screenshots/Capture%204.4.png) |

| Bouton *Export JSON* (téléchargement du rapport) |
|:---:|
| ![Export JSON](../../../assets/projects/h3-release-checker/screenshots/Capture%204.5.png) |

### 4.6 Déploiement

#### Image Docker multi-stage

```dockerfile
FROM python:3.13.11-slim AS python-base
...
FROM python-base AS builder-base
RUN apt-get install ... build-essential curl ssh
RUN curl -sSL https://install.python-poetry.org | python3 -
COPY poetry.lock pyproject.toml ./
RUN poetry install --no-root --without=dev
...
FROM python-base AS development
...
RUN poetry install --no-root --with=dev
USER appuser
ENTRYPOINT ["python", "-m", "app.web.main"]

FROM python-base AS production
COPY --from=builder-base $PYSETUP_PATH $PYSETUP_PATH
COPY ./app /app/app
USER appuser
ENTRYPOINT ["python", "-m", "app.web.main"]
```

L'image *production* ne contient ni le code source de Poetry, ni les dépendances de développement, ni les outils de build : elle est minimale et tourne sous un utilisateur non-root (`appuser`).

#### Profils Docker Compose

Le `compose.yaml` propose **trois profils** :

- `dev` : build local de l'image *development*, hot-reload via volume monté.
- `prod` : build local de l'image *production*.
- `registry` : utilise directement l'image *production* publiée sur le registry interne.

#### Cron sur `dashupgrade`

```shell
# Lundi à mercredi (et vendredi) à 8h HKT (2h CEST)
0 2 * * 1-3,5 $HOME/h3-releases-auto-follow-up/send_post.sh

# Mercredi à 8h et 12h CEST
0 8,12 * * 3 $HOME/h3-releases-auto-follow-up/send_post.sh
```

Le script `send_post.sh` applique une **logique de parité de semaine** :

- **Vendredi** : exécution uniquement les semaines **paires**.
- **Lundi à jeudi** : exécution uniquement les semaines **impaires**.

Cela colle au cycle des sprints de deux semaines : on contrôle l'avancement en début de sprint puis en fin, sans déranger les équipes en dehors des fenêtres utiles.

![Planning des exécutions](../../../assets/projects/h3-release-checker/screenshots/report_schedule.png)

| Pipeline GitLab CI (dernier *run* réussi) | Image Docker dans le registry interne |
|:---:|:---:|
| ![Pipeline GitLab](../../../assets/projects/h3-release-checker/screenshots/Capture%2011.1.png) | ![Docker registry](../../../assets/projects/h3-release-checker/screenshots/Capture%2011.2.png) |

| Liste des conteneurs Docker sur `dashupgrade` | Tâches planifiées sur `dashupgrade` |
|:---:|:---:|
| ![Docker compose ps](../../../assets/projects/h3-release-checker/screenshots/Capture%2011.3.png) | ![Crontab](../../../assets/projects/h3-release-checker/screenshots/Capture%2011.4.png) |

### 4.7 Mode démonstration et build d'examen

Pour pouvoir présenter l'outil **lors de l'épreuve E6**, sans accès au réseau d'entreprise, j'ai mis en place :

- Un mode démonstration activable par variable d'environnement, qui remplace `JiraService`, `PsrvService`, `LdapService` et `LuccaCalendar` par leurs équivalents [*mock*](https://github.com/wblondel/h3-release-checker/app/logic/services/mock_services.py). Le mode démonstration génère un rapport plausible (avec des tickets factices et quelques anomalies représentatives) et conserve l'expérience utilisateur intacte.
- Une copie locale du paquet privé `lucca` dans `vendor/lucca/`.
- Un **`Dockerfile.exam`**, un **`pyproject.exam.toml`** et un **`compose.exam.yaml`** qui *override* la configuration standard pour pointer vers le `lucca` *vendored*. Ce build n'a besoin d'aucun accès SSH au GitLab interne.
- Le tout documenté dans [`README.exam.md`](https://github.com/wblondel/h3-release-checker/README.exam.md).

---

## 5. Tests et qualité de code

### 5.1 Stratégie de test

- **Tests unitaires des services métier** : ils valident que `ReleaseReportGenerator` produit le bon `TicketSummary` pour des cas variés (ticket OK, ticket avec *fix version* invalide, package inconnu, *change request* désactivée, etc.).
- **Tests des composants web**.
- **Tests asynchrones** avec `pytest-asyncio`.
- **Mocks** des services externes (`pytest-mock`) pour ne jamais dépendre du réseau pendant les tests.
- **Cas d'erreur** : la suite vérifie également que `_save_failure_record` persiste bien les exécutions qui échouent, que les exceptions Jira / LDAP sont correctement propagées et que la notification Teams est *fail-safe* (statut `partial`).

### 5.2 Linting et formatage

- **Ruff** est configuré avec le preset `ALL` (cf. `pyproject.toml`), ce qui active toutes les règles disponibles.
- Les exceptions sont **explicitement justifiées** par fichier (`per-file-ignores`).
- Le code respecte une longueur de ligne de 120 caractères et la convention `google` pour les *docstrings*.

| Sortie de `pytest` | Sortie de `ruff check` |
|:---:|:---:|
| ![pytest](../../../assets/projects/h3-release-checker/screenshots/Capture%2012.1.png) | ![ruff check](../../../assets/projects/h3-release-checker/screenshots/Capture%2012.2.png) |

### 5.3 Refactorings successifs

Plusieurs refactorings visant à améliorer la maintenabilité ou ajouter des fonctionnalités ont été nécessaires :

- `90670f` : remplacement des longues listes d'arguments par des *dataclasses*.
- `91d52ae` : modularisation de l'interface web en composants et onglets séparés.
- `2639885` : migration du stockage de l'historique d'un fichier JSON vers SQLite + SQLAlchemy.
- `45f4acb` : ajout de l'authentification Entra ID.

---

## 6. Compétences mobilisées (référentiel BTS SIO)

| Compétence | Comment elle a été mobilisée dans ce projet |
|---|---|
| **Analyser un besoin exprimé et son contexte juridique** | Lecture, formalisation et validation de la check-list manuelle existante avec le Release Manager et la QA. Prise en compte du contexte réglementaire interne (sécurité des accès, gestion des secrets, RGPD pour les données personnelles AD). |
| **Participer à la conception de l'architecture d'une solution applicative** | Conception en couches CLI / logique / web, séparation des responsabilités, choix d'une orchestration centralisée (`ReleaseChecker`). |
| **Modéliser une solution applicative** | Modèles `dataclass` (`TicketSummary`, `ReportContext`, `ReleaseCheckerConfig`), modèles SQLAlchemy (`ExecutionRecord`), modèles Pydantic (Adaptive Cards Teams). |
| **Exploiter les ressources d'un cadre applicatif (framework)** | FastAPI / NiceGUI pour le web, Typer pour la CLI, SQLAlchemy ORM pour la BD, Pydantic Settings pour la configuration. |
| **Identifier, développer, utiliser ou adapter des composants logiciels** | Développement de composants NiceGUI réutilisables (`ReleaseCheckForm`, `PsrvControl`, `ToolsUpdate`), wrappers `JiraClient`, `LdapService`. |
| **Exploiter les technologies Web pour mettre en œuvre les échanges entre applications** | Appels REST asynchrones avec `httpx`, intégration OAuth 2.0 avec MSAL, webhooks Power Automate, API Atlassian Jira Cloud, API PSRV REST, API Lucca, API Azul Zulu. |
| **Utiliser des composants d'accès aux données** | SQLAlchemy 2.0 (sessions, *DeclarativeBase*, `mapped_column`, requêtes ORM, *upsert*), `lru_cache` pour la résolution de service Jira, sérialisation JSON pour les payloads. |
| **Intégrer en continu les versions d'une solution applicative** | Pipeline GitLab CI, build et publication automatique de l'image Docker dans le registry interne, profils Compose `dev` / `prod` / `registry`, *cron* sur `dashupgrade`. |
| **Réaliser les tests nécessaires à la validation ou à la mise en production** | Tests unitaires `pytest`, tests asynchrones, tests de composants web, vérifications de cas d'erreurs, exécution manuelle de bout en bout en mode démo. |
| **Rédiger des documentations technique et d'utilisation** | [`README.md`](https://github.com/wblondel/h3-release-checker/README.md) complet (build, configuration, commandes, déploiement), [`README.exam.md`](https://github.com/wblondel/h3-release-checker/README.exam.md) (build d'examen *offline*), docstrings Google sur toutes les fonctions publiques, ce compte rendu, et l'[Annexe VII-1-B](/documents/E6/BLONDEL_WILLIAM_VII-1-B_R2.pdf). |
| **Exploiter les fonctionnalités d'un environnement de développement et de tests** | PyCharm, debugger Python, intégration ruff, pytest, Docker Compose, Git/GitLab. |
| **Recueillir, analyser et mettre à jour les informations sur une version d'une solution applicative** | Versionnage sémantique, historique Git riche, documentation des évolutions dans les commits *feat:* / *fix:* / *refactor:*, mise à jour de la documentation interne *« How To Deliver a H3 Service Pack »*. |
| **Évaluer la qualité d'une solution applicative** | Linter Ruff *preset ALL*, suite de tests, revue manuelle des refactorings, surveillance de la durée d'exécution (champ `duration_seconds` dans la base). |
| **Analyser et corriger un dysfonctionnement** | Plusieurs commits *fix:* (`fix: app gets stuck when Jira instance is not responding`, `fix(release_check): resolve ruff issues and refactor db sessions`…) : diagnostic à partir des logs d'exécution stockés en base, reproduction en mode démo, correction et test. |
| **Mettre à jour des documentations technique et d'utilisation d'une solution applicative** | Mise à jour de `README.md` à chaque évolution majeure, mise à jour du document interne *« How To Deliver a H3 Service Pack »* après mise en service de l'outil. |
| **Élaborer et réaliser les tests des éléments mis à jour** | À chaque refactoring (par exemple la migration JSON → SQLite), ajout de tests dédiés et exécution complète de la suite. |
| **Exploiter des données à l'aide d'un langage de requêtes** | Requêtes ORM SQLAlchemy (`session.query(ExecutionRecord).order_by(...).all()`), filtres en Python sur les listes de tickets, JQL côté Jira (`project = ET AND fixVersion = "..."`). |
| **Développer des fonctionnalités applicatives au sein d'un système de gestion de base de données** | Création d'un schéma SQLite via SQLAlchemy `Base.metadata.create_all`, sérialisation/désérialisation JSON dans des colonnes `Text`, *upsert* manuel pour les exécutions partielles. |
| **Concevoir ou adapter une base de données** | Choix du modèle (table unique `executions` avec colonnes JSON), choix des index (`timestamp`, `status`), évolution du schéma sans migration formelle (SQLite local, recréation autorisée). |
| **Administrer et déployer une base de données** | SQLite *file-based*, persistance dans le volume Docker `storage/`, sauvegarde simple par copie de fichier. |

---

## 7. Bilan et perspectives

### 7.1 Bilan fonctionnel

L'outil est **en production** et utilisé **quotidiennement**. Il a remplacé la check-list manuelle dans la nouvelle version de la documentation interne (cf. [`How-To-Deliver-H3-after-automated-tool.md`](../How-To-Deliver-H3-after-automated-tool.md)). Les Release Managers successifs n'ont plus à effectuer les contrôles à la main : ils consultent simplement le rapport posté automatiquement sur Teams et n'interviennent que lorsque celui-ci signale une anomalie.

**Gains mesurables** :

- Temps consacré aux contrôles manuels : **divisé par 5 à 10**.
- Erreurs humaines (oubli de *resync*, *fix version* ratée) : **éliminées**.
- Visibilité de l'équipe sur l'état d'avancement de la release : **améliorée** (rapport quotidien sur Teams).

### 7.2 Bilan personnel

Ce projet m'a permis de mener **un projet logiciel complet de bout en bout** : analyse, conception, développement, tests, déploiement, maintenance, support utilisateurs, refactorings, sécurisation. Il est représentatif du métier de développeur en entreprise : on y trouve aussi bien des questions d'architecture (où mettre la limite entre couches ?) que des problèmes très concrets (comment résoudre un UPN à partir d'un e-mail ? comment faire fonctionner Java et Python ensemble dans un conteneur ?).

J'ai particulièrement apprécié :

- l'**impact concret** sur l'équipe (les utilisateurs sont mes propres collègues) ;
- la **richesse de l'écosystème** Python (Jira, MSAL, ldap3, SQLAlchemy, NiceGUI, Pydantic, httpx) ;
- la **liberté d'architecture** que m'a laissée mon tuteur, et le retour qu'il m'a donné à chaque revue ;
- la **mise en production réelle** : l'outil tourne tous les jours et il faut donc qu'il soit **robuste**.

### 7.3 Perspectives d'évolution

- Étendre l'outil à d'autres distributions que H3.
- Permettre une *whitelist* / *blacklist* de packages, afin de pouvoir ignorer volontairement certaines anomalies récurrentes.
- Migrer SQLite vers PostgreSQL si la base d'historique grossit (plusieurs années d'historique).
- Intégrer la **vérification du QC** (statut Jira *Quality Control*) directement dans le rapport.
