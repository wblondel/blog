---
title: "Un service de raccourcissement d'URL avec uniquement le serveur Caddy"
seoTitle: "Un raccourcisseur d'URL avec uniquement Caddy"
description: "Comment construire un raccourcisseur d'URL avec uniquement le serveur Caddy et GitHub. Remplacement de YOURLS par une solution minimale et auto-hébergée avec Docker et Fly.io."
pubDate: 2024-02-10T21:41:00.000Z
coverImage: "../../../assets/post-covers/url_shortener.jpg"
tags: ["Caddy", "Raccourcisseur d'URL", "GitHub", "Makefile", "GitHub Actions", "Fly.io", "Docker", "CI CD", "Sauvegarde", "Dependabot"]
readTime: 16
---

## Introduction

En 2019, lorsque j'ai commencé mes recherches généalogiques, j'ai rapidement constaté quelque chose : les liens vers les actes d'état civil peuvent être [très longs](https://archives.paris.fr/arkotheque/visionneuse/visionneuse.php?arko=YTo2OntzOjQ6ImRhdGUiO3M6MTA6IjIwMjAtMDktMDciO3M6MTA6InR5cGVfZm9uZHMiO3M6MTE6ImFya29fc2VyaWVsIjtzOjQ6InJlZjEiO2k6NDtzOjQ6InJlZjIiO2k6MjQ5MDYxO3M6MTY6InZpc2lvbm5ldXNlX2h0bWwiO2I6MTtzOjIxOiJ2aXNpb25uZXVzZV9odG1sX21vZGUiO3M6NDoicHJvZCI7fQ==).

Au départ, je voulais utiliser le raccourcisseur d'URL de Google, mais il avait déjà été [abandonné](https://web.archive.org/web/20230518174804/https://developers.googleblog.com/2018/03/transitioning-google-url-shortener.html). Google recommandait d'utiliser [Bitly](https://bitly.com/), [Owly](https://ow.ly/) ou [Firebase Dynamic Links](https://firebase.google.com/docs/dynamic-links) à la place. Les deux premiers services étaient payants (et le sont toujours), et je n'avais pas envisagé le dernier car il semblait trop complexe à mettre en place. C'était une bonne décision, car Firebase Dynamic Links est déjà [déprécié](https://firebase.google.com/support/dynamic-links-faq) et sera arrêté le 25 août 2025.

J'ai alors décidé d'utiliser une solution open source auto-hébergée, et j'ai trouvé [YOURLS](https://yourls.org/).

YOURLS est un raccourcisseur d'URL basé sur PHP qui propose des bookmarklets, une API développeur, et des statistiques détaillées avec l'historique des clics, le suivi des référents et la géolocalisation des visiteurs. Il est extensible grâce à des plugins.

Après quelques années, j'ai réalisé que je n'avais pas besoin de toutes ces fonctionnalités. Je voulais simplement quelque chose de simple, quelque chose qui redirige. Et qu'est-ce qui redirige ? Un serveur web, bien sûr !

C'est parti !

## Prérequis

Voici les exigences que je me suis fixées pour [ce projet](https://github.com/wblondel/actes.williamblondel.fr/) :

1. La redirection des utilisateurs doit être effectuée uniquement par un serveur web, c'est-à-dire qu'il n'y a pas d'application web.

2. Je dois pouvoir créer et supprimer des URLs courtes depuis un terminal.

3. Les scripts de gestion des URLs courtes ne doivent pas dépendre d'un autre langage de programmation (ex. Python, PHP, ...), cependant la dépendance aux outils couramment installés est autorisée.

4. En lien avec le point #2, le serveur web doit être configurable via une API.

5. Je dois pouvoir stocker un titre pour chaque URL courte que je crée, sans base de données ni fichiers supplémentaires.

6. La configuration du serveur web doit être sauvegardée périodiquement quelque part, afin de pouvoir être rechargée après un redémarrage.


## Choix techniques

### Serveur web

J'ai décidé d'utiliser [Caddy](https://caddyserver.com/) comme serveur web, car il peut être configuré via un [point d'administration](https://caddyserver.com/docs/api) accessible en HTTP via une API REST.

Chaque élément de la configuration peut être [accédé directement via un identifiant](https://caddyserver.com/docs/api#using-id-in-json) attribué lors de sa création. C'est parfait : cela me donne un champ supplémentaire pour stocker des données (le titre !), ainsi qu'un moyen d'interagir directement avec les URLs déjà créées.

### Gestion des URLs

Sur la plupart de mes projets, j'utilise un Makefile pour automatiser les tâches répétitives. Ce projet ne fait pas exception : un Makefile sert d'interface CLI de type CRUD.

### Service d'hébergement

Il y a quelques mois, je suis tombé sur [Fly.io](https://fly.io/) et je l'ai ajouté à ma liste de services « à tester ». Il est parfait pour ce projet : le déploiement d'une application ou d'un service se fait via [leur CLI](https://fly.io/docs/apps/deploy/) (`flyctl`), et il existe une [GitHub Action officielle](https://fly.io/docs/app-guides/continuous-deployment-with-github-actions/). Un fichier `fly.toml` est utilisé pour configurer une application pour le déploiement sur Fly.io.

## Configuration du déploiement

Je serai bref sur la configuration du déploiement Fly.io, car ce n'est pas le cœur de cet article.

Grâce à la [documentation très claire](https://fly.io/docs/reference/configuration/), j'ai obtenu [cette configuration](https://github.com/wblondel/actes.williamblondel.fr/blob/main/fly.toml) :

```ini
app = "actes-williamblondel-fr"
primary_region = "cdg"
kill_signal = "SIGINT"
kill_timeout = "5s"
swap_size_mb = 512

[build]

[http_service]
  internal_port = 80
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  processes = ["app"]

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

Explication :

* `app` est le nom de l'application.

* `primary_region` indique où seront situées les instances qui hébergent mon application.

* `kill_signal` est le signal que Fly enverra au processus en cours d'exécution lors de l'arrêt de l'instance.

* `kill_timeout` est le délai d'attente avant l'arrêt de l'instance, après l'envoi du signal défini par `kill_signal`.

* L'option `swap_size_mb` crée une partition de swap de cette taille et l'active. C'est simplement une précaution, au cas où Caddy manquerait de mémoire.

* Lorsqu'une section `[build]` vide est définie, `flyctl` cherchera par défaut un `Dockerfile` à la racine de l'application.

* La section `http_service` définit un service Fly qui écoute sur les ports 80 et 443.

    * Le service communiquera avec Caddy sur l'`internal_port`, qui est le port 80.

    * Fly appliquera les redirections HTTP vers HTTPS grâce à `force_https`.

    * `auto_stop_machines` est défini à `false` car je ne veux pas que l'instance s'arrête en l'absence de trafic.

    * `auto_start_machines` est défini à `true` car je veux que l'instance démarre automatiquement.

    * `processes` est le groupe de processus auquel appartient ce service.

* La section `vm` définit les ressources de calcul pour les instances utilisées par l'application. J'utilise la [plus petite instance disponible](https://fly.io/docs/about/pricing/#compute), une instance avec 1 vCPU partagé et 256 Mo de RAM.


Le [`Dockerfile`](https://github.com/wblondel/actes.williamblondel.fr/blob/main/Dockerfile) est relativement simple :

```dockerfile
FROM caddy:2.7.6-alpine

RUN apk add curl --no-cache

COPY ./conf/caddy-config-loader.json /etc/caddy/caddy-config-loader.json

CMD ["caddy", "run", "--config", "/etc/caddy/caddy-config-loader.json"]
```

J'utilise l'[image Docker officielle de Caddy](https://hub.docker.com/_/caddy) comme base, sur laquelle je :

* installe curl (j'enverrai des requêtes au point d'administration de Caddy via l'instance en SSH plutôt que d'y [accéder à distance](https://caddyserver.com/docs/json/admin/remote/)) ;

* copie la configuration que Caddy chargera au démarrage ;

* configure Caddy pour utiliser cette configuration.


## Configuration de Caddy

Examinons la configuration initiale de Caddy, [`/conf/caddy-config-loader.json`](https://github.com/wblondel/actes.williamblondel.fr/blob/main/conf/caddy-config-loader.json) :

```json
{
  "admin": {
    "config": {
      "load": {
        "module": "http",
        "url": "https://raw.githubusercontent.com/wblondel/actes.williamblondel.fr/main/conf/caddy-config.json",
        "adapter": "json"
      }
    }
  }
}
```

Cette configuration initiale indique à Caddy de [récupérer sa configuration dynamiquement](https://caddyserver.com/docs/json/admin/config/load/) au démarrage. La configuration récupérée remplace entièrement la configuration actuelle.

La configuration récupérée est disponible [ici](https://github.com/wblondel/actes.williamblondel.fr/blob/main/conf/caddy-config.json), et contient toutes les règles de redirection (les URLs).

Au format `Caddyfile`, la configuration récupérée ressemble à ceci :

```json
http://actes-williamblondel-fr.fly.dev, http://actes.williamblondel.fr {
	map {path} {redirect-uri} {
		/ab1cdefg https://github.com/wblondel
		default not_found
	}

	@hasRedir expression `{redirect-uri} != "not_found"`
	redir @hasRedir {redirect-uri}

	respond "That's an unknown short URL ... :(" 404
}
```

Le certificat SSL et la redirection vers HTTPS sont gérés par Fly.io, donc je les désactive dans la configuration Caddy en ajoutant `http://` devant les hôtes.

J'ai inclus une URL à titre d'exemple.

Cependant, la configuration récupérée doit être au format JSON. Je l'ai donc convertie ainsi :

```bash
caddy adapt --config conf/Caddyfile --adapter caddyfile --pretty
```

Ce qui a donné la configuration suivante (première version de [`/conf/caddy-config.json`](https://github.com/wblondel/actes.williamblondel.fr/blob/main/conf/caddy-config.json)) :

```json
{
  "apps": {
    "http": {
      "servers": {
        "srv0": {
          "listen": [
            ":80"
          ],
          "routes": [
            {
              "match": [
                {
                  "host": [
                    "actes-williamblondel-fr.fly.dev",
                    "actes.williamblondel.fr"
                  ]
                }
              ],
              "handle": [
                {
                  "handler": "subroute",
                  "routes": [
                    {
                      "handle": [
                        {
                          "defaults": [
                            "not_found"
                          ],
                          "destinations": [
                            "{redirect-uri}"
                          ],
                          "handler": "map",
                          "mappings": [
                            {
                              "input": "/ab1cdefg",
                              "outputs": [
                                "https://github.com/wblondel"
                              ]
                            }
                          ],
                          "source": "{http.request.uri.path}"
                        }
                      ]
                    },
                    {
                      "handle": [
                        {
                          "handler": "static_response",
                          "headers": {
                            "Location": [
                              "{redirect-uri}"
                            ]
                          },
                          "status_code": 302
                        }
                      ],
                      "match": [
                        {
                          "expression": "{redirect-uri} != \"not_found\""
                        }
                      ]
                    },
                    {
                      "handle": [
                        {
                          "body": "That's an unknown short URL ... :(",
                          "handler": "static_response",
                          "status_code": 404
                        }
                      ]
                    }
                  ]
                }
              ],
              "terminal": true
            }
          ]
        }
      }
    }
  }
}
```

Maintenant que j'ai à la fois le chargeur de configuration Caddy et la configuration Caddy, je peux committer, pousser et déployer le service...

... et ça fonctionne !

## Gestion des URLs avec un Makefile

### Boilerplate

Explorons le [Makefile](https://github.com/wblondel/actes.williamblondel.fr/blob/main/Makefile).

Je commence toujours par mon boilerplate standard :

```bash
.DEFAULT_GOAL := help

include .env
export

.PHONY: help # List available commands
help:
	@echo "Available commands:"
	@echo
	@grep '^.PHONY: .* #' Makefile | sed 's/\.PHONY: \(.*\) # \(.*\)/\1 >> \2/' | expand -t20
```

La cible `help` affiche la liste des cibles / commandes disponibles dans le `Makefile`, ainsi que le commentaire écrit à côté d'elles.

Avec la [variable spéciale](https://www.gnu.org/software/make/manual/html_node/Special-Variables.html) `.DEFAULT_GOAL`, je peux définir la cible par défaut du `Makefile` sur `help`. Ainsi, exécuter `make` afficherait :

```bash
Available commands:

help >> List available commands
```

Je charge également le contenu du fichier .env, qui contient deux variables : `CADDY_ADMIN_API` et `APP_URL`.

```yaml
CADDY_ADMIN_API=http://127.0.0.1:2019
APP_URL=https://example.org
```

### Raccourcir une URL : short

```makefile
MAPPINGS_ROUTE := "/config/apps/http/servers/srv0/routes/0/handle/0/routes/0/handle/0/mappings"

base64url_encode = $(shell printf '%s' "$1" | base64 | tr '/+' '_-' | tr -d '=')

.PHONY: short # Shorten a URL
short:
ifndef url
	$(error url is undefined)
endif
ifndef shortcode
	$(eval shortcode := $(shell dd if=/dev/urandom bs=4 count=2 2>/dev/null | xxd -p | tr -dc 'a-zA-Z0-9' | head -c 8))
endif
ifndef title
	$(error title is undefined)
endif
	$(eval encoded_title := $(call base64url_encode,$(title)))

	@echo "Shortcode: $(shortcode)..."
	@echo "Encoded title: $(encoded_title)"
	@flyctl ssh console --command "curl -s -X PUT -H 'Content-Type: application/json' -d '{\"@id\":\"$(encoded_title)\",\"input\":\"/$(shortcode)\",\"outputs\":[\"$(url)\"]}' $(CADDY_ADMIN_API)$(MAPPINGS_ROUTE)/0"
	@echo "$(APP_URL)/$(shortcode)"
```

Avec cette commande, on peut créer un lien court qui redirige vers une `url` spécifique. Un `shortcode` peut être fourni, sinon il sera généré automatiquement.

La variable `MAPPINGS_ROUTE` contient le chemin vers l'objet mappings qui contient les règles de redirection. Elle est réutilisée tout au long du `Makefile`.

Si un `shortcode` n'est pas fourni, il est généré automatiquement :

1. Avec `dd`, on lit 2 blocs de 4 octets via l'interface vers le générateur de nombres aléatoires du noyau ;

2. Avec `xxd`, on convertit les données binaires en représentation hexadécimale (`-p`). Cela donne 16 caractères, mais peut en donner moins dans de rares circonstances ;

3. Avec `tr`, on filtre tous les caractères qui ne sont pas alphanumériques. L'option `-d` supprime les caractères, et l'option `-c` inverse l'ensemble spécifié. Cela garantit que l'on obtient uniquement des caractères alphanumériques ;

4. Avec `head`, on sélectionne les 8 premiers caractères de la sortie.


Le titre est encodé en [Base64URL](https://base64.guru/standards/base64url) : la fonction `base64url_encode` définie est appelée avec la variable `title` comme paramètre.

Cette fonction encode la valeur au format base64, modifie l'encodage base64 pour le rendre compatible avec les URLs (elle remplace `/` par `_` et `+` par `-`), et supprime les caractères de remplissage (`=`).

La chaîne encodée en Base64URL sera l'[identifiant de la règle de redirection](https://caddyserver.com/docs/api#using-id-in-json). J'ai choisi Base64URL car l'identifiant ne peut pas contenir certains caractères spéciaux, et ce format peut être décodé pour récupérer le titre.

Enfin, il est temps d'appeler l'API Caddy. Voici la commande formatée pour une meilleure lisibilité :

```bash
curl -s -X PUT \
    -H 'Content-Type: application/json'
    -d @payload.json \
    $(CADDY_ADMIN_API)$(MAPPINGS_ROUTE)/0"
```

Le `payload.json` étant :

```json
{
  "@id": "$(encoded_title)",
  "input": "/$(shortcode)",
  "outputs": [
    "$(url)"
  ]
}
```

Dans le `Makefile`, un payload inline est utilisé.

### Supprimer une URL par son identifiant ou son shortcode : delete

```makefile
MAPPINGS_ROUTE := "/config/apps/http/servers/srv0/routes/0/handle/0/routes/0/handle/0/mappings"

.PHONY: delete # Delete a URL by ID or shortcode
delete:
ifdef id
	@echo "Deleting route with ID $(id)"
	@flyctl ssh console --command "curl -s -X DELETE $(CADDY_ADMIN_API)/id/$(id)"
else ifdef shortcode
	@echo "Fetching route..."
	@make shortcode= id=$$(flyctl ssh console --quiet --command "curl -s $(CADDY_ADMIN_API)$(MAPPINGS_ROUTE)" | jq -r '.[] | select(.["input"] == "/$(shortcode)") | .["@id"]') delete
else
	$(error id or shortcode should be defined)
endif
```

Avec cette commande, on peut supprimer n'importe quel lien court, soit par son `id` (le titre encodé) soit par son `shortcode` :

```bash
make delete id="VGVzdCBQYWdl"
make delete shortcode="62f21770"
```

Si un `id` est défini, l'API Caddy est appelée :

```bash
curl -s -X DELETE $(CADDY_ADMIN_API)/id/$(id)"
```

Sinon, mais si un `shortcode` est défini, l'`id` de la règle de redirection correspondante est récupéré et la cible `delete` est à nouveau appelée avec la variable `id` définie.

D'abord, la liste des règles de redirection est récupérée :

```bash
curl -s $(CADDY_ADMIN_API)$(MAPPINGS_ROUTE)
```

Exemple de sortie :

```json
[
  {
    "input": "/ab1cdefg",
    "outputs": [
      "https://github.com/wblondel"
    ]
  }
]
```

Ensuite, [`jq`](https://jqlang.github.io/jq/manual/v1.7/) :

* itère sur chaque élément du tableau JSON de niveau supérieur : `.[]` ;

* sélectionne uniquement l'élément dont la valeur de la clé "input" (le `shortcode`) est égale à la valeur de la variable `shortcode` ;

* extrait la valeur de la clé `@id` (le titre encodé) de l'élément sélectionné.


```json
jq -r '.[] | select(.["input"] == "/$(shortcode)") | .["@id"]'
```

Si `jq` ne peut pas trouver l'élément demandé, il retourne `null`.

La cible `delete` est alors appelée avec la variable `id` définie sur la sortie de `jq` et avec la variable `shortcode` définie sur `null`.

Si `jq` retourne `null`, les deux variables sont `null` et la cible `delete` retourne une erreur.

### Afficher la configuration Caddy : show\_config

```makefile
.PHONY: show_config # Show the Caddy configuration
show_config:
	@flyctl ssh console --quiet --command "curl -s $(CADDY_ADMIN_API)/config/" | jq
```

Cette commande affiche proprement avec `jq` la configuration complète de Caddy au format JSON.

### Afficher la liste des règles de redirection : show\_routes

```makefile
MAPPINGS_ROUTE := "/config/apps/http/servers/srv0/routes/0/handle/0/routes/0/handle/0/mappings"
# Thank you Renaud Pacalet!
# @see https://stackoverflow.com/a/53865416/2699597
NULL :=
TAB := $(NULL)	$(NULL)

.PHONY: show_routes # Show the list of routes (JSON, CSV or table format)
show_routes:
ifndef output_format
	@flyctl ssh console --quiet --command "curl -s $(CADDY_ADMIN_API)$(MAPPINGS_ROUTE)" | jq
else
ifeq ($(output_format),json)
	@flyctl ssh console --quiet --command "curl -s $(CADDY_ADMIN_API)$(MAPPINGS_ROUTE)" | jq
else ifeq ($(output_format),table)
	@flyctl ssh console --quiet --command "curl -s $(CADDY_ADMIN_API)$(MAPPINGS_ROUTE)" | \
		jq -r 'map(.["@id"] |= @base64d) | ["@id", "input", "outputs"], (.[] | [.["@id"], .input, .outputs[]]) | @tsv' | \
		column -t -s'$(TAB)'
else ifeq ($(output_format),csv)
	@flyctl ssh console --quiet --command "curl -s $(CADDY_ADMIN_API)$(MAPPINGS_ROUTE)" | \
		jq -r 'map(.["@id"] |= @base64d) | ["@id", "input", "outputs"], (.[] | [.["@id"], .input, .outputs[]]) | @csv'
else
	@echo "Invalid output format: $(output_format)"
	@echo "Should be json, table, or csv"
endif
endif
```

<div data-node-type="callout">
<div data-node-type="callout-emoji">❗</div>
<div data-node-type="callout-text">Soyez prudent si vous copiez/collez ce snippet de code. Le caractère tabulation dans la variable TAB pourrait avoir été remplacé par 4 espaces.</div>
</div>

Cette commande affiche la liste des règles de redirection (routes) définies dans la configuration Caddy.

La variable `output_format` est optionnelle et vaut par défaut `json`, ce qui affiche le JSON formaté. Les formats de sortie disponibles sont `json`, `table` et `csv`.

Ces commandes `jq` semblent complexes, alors décortiquons-les.

```bash
jq -r 'map(.["@id"] |= @base64d) | ["@id", "input", "outputs"], (.[] | [.["@id"], .input, .outputs[]]) | @tsv' | \
column -t -s'$(TAB)'
```

Lorsque le format `output_format` est `table`, il :

* applique le [filtre @base64d](https://jqlang.github.io/jq/manual/v1.7/#format-strings-and-escaping) à la valeur de la clé `@id` pour chaque objet du tableau d'entrée. Ce filtre décode la chaîne encodée en base64 ;

* crée un tableau contenant les en-têtes de colonnes : `@id`, `input`, `outputs` ;

* combine le tableau précédent d'en-têtes de colonnes avec la sortie de l'expression suivante : `,` ;

* pour chaque objet du tableau d'entrée, crée un tableau contenant la valeur de la clé `@id`, la valeur de la clé `input`, et chaque valeur du tableau `outputs` ;

* convertit l'entrée au format TSV (valeurs séparées par des tabulations).


Ensuite, la sortie de `jq` est redirigée vers [`column`](https://man7.org/linux/man-pages/man1/column.1.html), qui formate son entrée en plusieurs colonnes. Avec l'option `-t`, il détermine le nombre de colonnes que contient l'entrée et crée un tableau. Le délimiteur possible des éléments d'entrée est spécifié avec l'option `-s` (par défaut, les espaces).

`column -t -s'\t'` ne fonctionne pas dans un Makefile car `make` supprime les chaînes avant de les utiliser comme arguments de diverses commandes ou instructions. [Une solution de contournement](https://stackoverflow.com/a/53865416/2699597) consiste à définir une variable `NULL` qui ne contient rien, et une variable `TAB` qui contient `NULL` + le caractère tabulation + `NULL`. Merci Renaud Pacalet !

Lorsque le format `output_format` est `csv`, `jq` est utilisé de façon similaire. L'entrée est convertie au format CSV (valeurs séparées par des virgules) à la place, et `column` n'est pas utilisé.

### Redémarrer l'application : restart\_app

```makefile
.PHONY: restart_app # Restart the app
restart_app:
	@flyctl apps restart
```

Cette commande redémarre l'application Fly.io.

### Arrêter Caddy : stop\_caddy

```makefile
.PHONY: stop_caddy # Gracefully shut down Caddy and exit the process
stop_caddy:
	@flyctl ssh console --command "curl -X POST $(CADDY_ADMIN_API)/stop"
```

Cette commande arrête proprement Caddy et termine le processus.

## CI/CD et sauvegardes automatiques

### Déploiement sur Fly.io à chaque push

En suivant [ce guide](https://fly.io/docs/app-guides/continuous-deployment-with-github-actions/), j'ai mis en place ce [workflow GitHub](https://github.com/wblondel/actes.williamblondel.fr/blob/main/.github/workflows/fly-deploy.yml) :

```plaintext
name: Fly Deploy
on:
  push:
    branches:
      - main

jobs:
  deploy:
    name: Deploy app
    runs-on: ubuntu-latest
    concurrency: deploy-group

    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@1.5
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

À chaque push sur la branche `main`, l'application est déployée.

### Sauvegarde automatique de la configuration Caddy

```plaintext
on:
  schedule:
    - cron: '*/30 * * * *'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  backup-caddy-config:
    name: Backup Caddy config
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@1.5
      - name: Fetch Caddy Config
        id: fetch-caddy-config
        run: |
          caddy_config=$(flyctl ssh console --command 'cat /config/caddy/autosave.json')
          echo "$caddy_config" | jq > conf/caddy-config.json
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

      - name: Check for changes
        id: check-changes
        run: |
          if [[ -n $(git status -s) ]]; then
            echo "Changes detected"
            echo "is_changed=1" >> "$GITHUB_OUTPUT"
            exit 0
          else
            echo "No changes to commit"
            echo "is_changed=0" >> "$GITHUB_OUTPUT"
            exit 0
          fi

      - name: Commit new Caddy Config
        if: ${{ steps.check-changes.outputs.is_changed == 1 }}
        run: |
          current_datetime=$(date -u +"%Y-%m-%d %H:%M:%S")
          commit_message="Caddy Config AutoSave - $current_datetime"
          git config user.name github-actions[bot]
          git config user.email 41898282+github-actions[bot]@users.noreply.github.com
          git add conf/caddy-config.json
          git commit -m "$commit_message"
          git push
```

[Ce workflow](https://github.com/wblondel/actes.williamblondel.fr/blob/main/.github/workflows/backup-caddy-config.yml) est configuré pour s'exécuter toutes les 30 minutes.

Il :

* récupère le dépôt ;

* récupère la configuration Caddy via le point d'administration et la sauvegarde dans `conf/caddy-config.json` ;

* vérifie s'il y a des modifications dans notre dépôt local, et définit la variable `is_changed` en conséquence ;

* commite la nouvelle configuration Caddy si des modifications ont été détectées.


Pour que le commit apparaisse correctement dans l'interface GitHub, le nom d'utilisateur et l'email git du bot doivent être configurés selon les valeurs fournies par l'[API GitHub](https://api.github.com/users/github-actions%5Bbot%5D). Merci [Ardis Lu](https://ardislu.dev/proper-git-for-github-actions) !

### Dependabot

Cette simple [configuration Dependabot](https://github.com/wblondel/actes.williamblondel.fr/blob/main/.github/dependabot.yml) permet les mises à jour automatiques des GitHub Actions utilisées et des tags d'images Docker :

```plaintext
# Set update schedule for GitHub Actions

version: 2
updates:

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "daily"
    assignees:
      - "wblondel"

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "daily"
    assignees:
      - "wblondel"
```

## Conclusion

C'est tout !

Ce fut un projet très amusant et intéressant sur lequel travailler, et j'étais impatient de le partager avec *le monde* ! N'hésitez pas à laisser un commentaire si vous avez des questions ou si cet article vous a été utile 😁 !

Le projet est disponible sur ce dépôt : [https://github.com/wblondel/actes.williamblondel.fr](https://github.com/wblondel/actes.williamblondel.fr).

Comme tous mes liens étaient dans YOURLS, j'ai dû écrire un script pour les migrer vers ce nouveau service. Vous pouvez trouver les scripts dans le dossier [scripts/importer](https://github.com/wblondel/actes.williamblondel.fr/tree/main/scripts/importer).
