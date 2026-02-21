---
title: "A URL shortener service using only the Caddy server"
description: "How to build a URL shortener using only the Caddy server and GitHub. Replacing YOURLS with a minimal, self-hosted solution using Docker and Fly.io."
pubDate: 2024-02-10T21:41:00.000Z
coverImage: "../../../assets/post-covers/url_shortener.jpg"
tags: ["Caddy", "URL Shortener", "GitHub", "Makefile", "GitHub Actions", "Fly.io", "Docker", "CI CD", "Backup", "Dependabot"]
readTime: 14
---

## Introduction

In 2019, when I started my genealogical research, I quickly noticed something: the links to civil status records can be [very long](https://archives.paris.fr/arkotheque/visionneuse/visionneuse.php?arko=YTo2OntzOjQ6ImRhdGUiO3M6MTA6IjIwMjAtMDktMDciO3M6MTA6InR5cGVfZm9uZHMiO3M6MTE6ImFya29fc2VyaWVsIjtzOjQ6InJlZjEiO2k6NDtzOjQ6InJlZjIiO2k6MjQ5MDYxO3M6MTY6InZpc2lvbm5ldXNlX2h0bWwiO2I6MTtzOjIxOiJ2aXNpb25uZXVzZV9odG1sX21vZGUiO3M6NDoicHJvZCI7fQ==).

Initially, I wanted to use Google's URL shortener, but it was already [discontinued](https://web.archive.org/web/20230518174804/https://developers.googleblog.com/2018/03/transitioning-google-url-shortener.html). Google recommended using [Bitly](https://bitly.com/), [Owly](https://ow.ly/), or [Firebase Dynamic Links](https://firebase.google.com/docs/dynamic-links) instead. The first two services were paid (and still are), and I didn't consider the last one because it seemed too complex to set up. That was a good decision, because Firebase Dynamic Links is already [deprecated](https://firebase.google.com/support/dynamic-links-faq) and will shut down on August 25, 2025.

I then decided to go with a self-hosted and open source solution, and I found [YOURLS](https://yourls.org/).

YOURLS is PHP-powered URL shortener that features bookmarklets, developer API, and awesome stats with historical click reports, referrers tracking and visitors geo-location. It is extensible thanks to plugins.

After a few years, I realized that I didn't need all these features. I just wanted something simple, something that redirects. And what redirects? A web server of course!

Let's begin!

## Requirements

Here are the requirements that I set for [this project](https://github.com/wblondel/actes.williamblondel.fr/):

1. Redirecting users must be done by a web server only, i. e., there is no web application.
    
2. I must be able to create and delete short URLs from a terminal.
    
3. The scripts to manage the short URLs mustn't depend on another programming language (e.g. Python, PHP, ...), however dependency on commonly-installed tools is allowed.
    
4. Related to #2, the web server must be configurable via API.
    
5. I must be able to store a title for each short URL I create, without a database or extra files.
    
6. The web server configuration must be periodically backed up somewhere, so that it can load it back after reboot.
    

## Technical choices

### Web server

I decided to use [Caddy](https://caddyserver.com/) as the web server, because it can be configured through an [administration endpoint](https://caddyserver.com/docs/api) which can be accessed via HTTP using a REST API.

Each element of the configuration can be [accessed directly via an ID](https://caddyserver.com/docs/api#using-id-in-json) that was given during its creation. This is perfect: this gives me an extra field to store data (the title!), and a way to directly interact with already-created URLs.

### URL management

On most of my projects, I use a Makefile to automate repetitive tasks. This project is no exception: a Makefile serves as the CRUD CLI.

### Hosting service

A few months ago I came across [Fly.io](https://fly.io/) and I put it in my "to experiment with" list of services. It is perfect for this project: deploying an app or service is done via [their CLI](https://fly.io/docs/apps/deploy/) (`flyctl`), and there is an [official GitHub Action](https://fly.io/docs/app-guides/continuous-deployment-with-github-actions/). A `fly.toml` file is used to configure an app for deployment on Fly.io.

## Deployment configuration

I will be quick on the Fly.io deployment configuration, because it is not the focus of this article.

Thanks to the [very clear documentation](https://fly.io/docs/reference/configuration/), I came up with [this configuration](https://github.com/wblondel/actes.williamblondel.fr/blob/main/fly.toml):

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

Explanation:

* The `app` is the application name.
    
* The `primary_region` is where the instance(s) that host my application will be located.
    
* The `kill_signal` is the signal that Fly will send to the running process when the instance is shut down.
    
* The `kill_timeout` is the time to wait before stopping the instance, after sending the signal set by `kill_signal`.
    
* The `swap_size_mb` option creates a swap partition of this size and enables it. It's just a precaution, in case Caddy runs out of memory.
    
* When an empty `[build]` section is set, `flyctl` will by default look for a `Dockerfile` in the application root.
    
* The `http_service` section defines a Fly service that listens on port 80 and 443.
    
    * The service will communicate with Caddy on the `internal_port`, which is 80.
        
    * Fly will enforce HTTP to HTTPS redirects thanks to `force_https`.
        
    * `auto_stop_machines` is set to `false` as I don't want the instance to stop when there is no traffic.
        
    * `auto_start_machines` is set to `true` as I want the instance to start automatically.
        
    * `processes` is the process group this service belongs to.
        
* The `vm` section defines the compute requirements for the instances used for the application. I use the [smallest instance available](https://fly.io/docs/about/pricing/#compute), an instance with a shared 1vCPU and 256MB of RAM.
    

The [`Dockerfile`](https://github.com/wblondel/actes.williamblondel.fr/blob/main/Dockerfile) is relatively simple:

```dockerfile
FROM caddy:2.7.6-alpine

RUN apk add curl --no-cache

COPY ./conf/caddy-config-loader.json /etc/caddy/caddy-config-loader.json

CMD ["caddy", "run", "--config", "/etc/caddy/caddy-config-loader.json"]
```

I use the [official Caddy Docker image](https://hub.docker.com/_/caddy) as a base, on which I:

* install curl (I will send request to the Caddy administration endpoint through the instance via SSH instead of [accessing it remotely](https://caddyserver.com/docs/json/admin/remote/));
    
* copy the configuration that Caddy will load on startup;
    
* set Caddy to use this configuration.
    

## Caddy configuration

Let's have a look at the initial Caddy configuration, [`/conf/caddy-config-loader.json`](https://github.com/wblondel/actes.williamblondel.fr/blob/main/conf/caddy-config-loader.json):

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

This initial configuration tells Caddy to [pull its config dynamically](https://caddyserver.com/docs/json/admin/config/load/) when it starts. The pulled config completely replaces the current one.

The pulled config is available [here](https://github.com/wblondel/actes.williamblondel.fr/blob/main/conf/caddy-config.json), and contains all the redirection rules (the URLs).

Using the `Caddyfile` format, the pulled configuration looks like this:

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

The SSL certificate and the redirection to HTTPS is handled by Fly.io so I disable that on the Caddy configuration by adding `http://` before the hosts.

I included one URL as an example.

However, the pulled configuration needs to be in JSON format. So I converted it like so:

```bash
caddy adapt --config conf/Caddyfile --adapter caddyfile --pretty
```

Which gave the following configuration (first version of [`/conf/caddy-config.json`](https://github.com/wblondel/actes.williamblondel.fr/blob/main/conf/caddy-config.json)):

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

Now that I have both the Caddy configuration loader and the Caddy configuration, I can commit, push, and deploy the service...

... and it works!

## Managing the URLs with a Makefile

### Boilerplate

Let's explore the [Makefile](https://github.com/wblondel/actes.williamblondel.fr/blob/main/Makefile).

I always start with my standard boilerplate:

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

The `help` target shows the list of available targets / commands in the `Makefile`, along with the comment written next to them.

With the `.DEFAULT_GOAL`[special variable](https://www.gnu.org/software/make/manual/html_node/Special-Variables.html), I can set the default target of the `Makefile` to `help`. This way, executing `make` would output:

```bash
Available commands:

help >> List available commands
```

I also load the content of the .env file, which has two variables: `CADDY_ADMIN_API` and `APP_URL` .

```yaml
CADDY_ADMIN_API=http://127.0.0.1:2019
APP_URL=https://example.org
```

### Shorten a URL: short

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

With this command, we can create a short link that redirects to a specific `url`. A `shortcode` can be provided, if not it will be generated automatically.

The `MAPPINGS_ROUTE` variable contains the path to the mappings object that contains the redirection rules. It is reused throughout the `Makefile`.

If a `shortcode` is not provided, it is automatically generated:

1. With `dd`, it reads 2 blocks of 4 bytes through the interface to the kernel's random number generator;
    
2. With `xxd`, it converts the binary data into hexadecimal representation (`-p`). This gives us 16 characters, however it could be less under rare circumstances;
    
3. With `tr`, it filters out any characters that are not alphanumeric. The `-d` option deletes characters, and the `-c` option negates the set specified. This ensures that we only get alphanumeric characters;
    
4. With `head`, it selects the first 8 characters from the output.
    

The title is encoded into [Base64URL](https://base64.guru/standards/base64url): the defined `base64url_encode` function is called with the variable `title` as a parameter.

This function encodes the value in base64 format, modifies the base64 encoding to make it URL-safe (it replaces `/` with `_` and `+` with `-` ), and removes any padding characters (`=`).

The Base64URL encoded string will be the [ID of the redirection rule](https://caddyserver.com/docs/api#using-id-in-json). I chose Base64URL because the ID cannot contain some special characters and this format can be decoded to retrieve the title.

Finally, time to call the Caddy API. Here is the formatted command for better readability:

```bash
curl -s -X PUT \
    -H 'Content-Type: application/json'
    -d @payload.json \
    $(CADDY_ADMIN_API)$(MAPPINGS_ROUTE)/0"
```

The `payload.json` being:

```json
{
  "@id": "$(encoded_title)",
  "input": "/$(shortcode)",
  "outputs": [
    "$(url)"
  ]
}
```

In the `Makefile`, an inline payload is used.

### Delete a URL by its ID or shortcode: delete

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

With this command, we can delete any short link, either by its `id` (the encoded title) or by its `shortcode`:

```bash
make delete id="VGVzdCBQYWdl"
make delete shortcode="62f21770"
```

If an `id` is defined, the Caddy API is called:

```bash
curl -s -X DELETE $(CADDY_ADMIN_API)/id/$(id)"
```

If not, but if a `shortcode` is defined, the `id` of the relevant redirection rule is fetched and the `delete` target is called again with the `id` variable set.

First the list of redirection rules is retrieved:

```bash
curl -s $(CADDY_ADMIN_API)$(MAPPINGS_ROUTE)
```

Sample output:

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

Then, [`jq`](https://jqlang.github.io/jq/manual/v1.7/):

* iterates over each element of the JSON array at the top level: `.[]`;
    
* selects only the element where the value of the key "input" (the `shortcode`) is equal to the value of the variable `shortcode`;
    
* extracts the value of the key `@id` (the encoded title) from the selected element.
    

```json
jq -r '.[] | select(.["input"] == "/$(shortcode)") | .["@id"]'
```

If `jq` cannot find the requested element, it returns `null`.

The `delete` target is then called with the `id` variable set to the output of `jq` and with the `shortcode` variable set to `null`.

If `jq` returns `null`, both variables are `null` and the `delete` target returns an error.

### Show the Caddy configuration: show\_config

```makefile
.PHONY: show_config # Show the Caddy configuration
show_config:
	@flyctl ssh console --quiet --command "curl -s $(CADDY_ADMIN_API)/config/" | jq
```

This command pretty prints with `jq` the full JSON Caddy configuration.

### Show the list of redirection rules: show\_routes

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
<div data-node-type="callout-text">Be careful if you copy/paste this code snippet. The tab character in the TAB variable might have been replaced by 4 spaces.</div>
</div>

This command shows the list of redirection rules (routes) defined in the Caddy configuration.

The `output_format` variable is optional and defaults to `json`, which pretty prints the JSON. Available output formats are `json`, `table`, and `csv`.

These `jq` commands seem complex so let's break them down.

```bash
jq -r 'map(.["@id"] |= @base64d) | ["@id", "input", "outputs"], (.[] | [.["@id"], .input, .outputs[]]) | @tsv' | \
column -t -s'$(TAB)'
```

When the `output_format` is `table` , it:

* applies the [@base64d filter](https://jqlang.github.io/jq/manual/v1.7/#format-strings-and-escaping) to the value of the key `@id` for each object in the input array. This filter decodes the base64-encoded string;
    
* creates an array containing column headers: `@id`, `input`, `outputs`;
    
* combines the previous array of column headers with the output of the next expression: `,` ;
    
* for each object in the input array, creates an array containing the value of the key `@id`, the value of the key `input`, and each value in the array `outputs` ;
    
* converts the input into a tab-separated values (TSV) format
    

Then, the output of `jq` is piped to [`column`](https://man7.org/linux/man-pages/man1/column.1.html), which formats its input into multiple columns. With the `-t` option, it determines the number of columns the input contains and create a table. The possible input item delimiters is specified with the `-s` option (default is whitespace).

`column -t -s'\t'` does not work in a Makefile because `make` strips strings before using them as arguments of various commands or statements. [A workaround](https://stackoverflow.com/a/53865416/2699597) is to define a variable `NULL` that contains nothing, and a variable `TAB` that contains `NULL` + the tab character + `NULL`. Thank you Renaud Pacalet!

When the `output_format` is `csv` , `jq` is similarly used. The input is converted into a comma-separated values (CSV) format instead, and `column` is not used.

### Restart the app: restart\_app

```makefile
.PHONY: restart_app # Restart the app
restart_app:
	@flyctl apps restart
```

This command restarts the Fly.io application.

### Shut down Caddy: stop\_caddy

```makefile
.PHONY: stop_caddy # Gracefully shut down Caddy and exit the process
stop_caddy:
	@flyctl ssh console --command "curl -X POST $(CADDY_ADMIN_API)/stop"
```

This command gracefully shuts down Caddy and exits the process.

## CI/CD and automatic backups

### Deploy to Fly.io on push

Following [this guide](https://fly.io/docs/app-guides/continuous-deployment-with-github-actions/), I setup this [GitHub workflow](https://github.com/wblondel/actes.williamblondel.fr/blob/main/.github/workflows/fly-deploy.yml):

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

Every time a push is done to the `main` branch, the application is deployed.

### Automatic backup of the Caddy configuration

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

[This workflow](https://github.com/wblondel/actes.williamblondel.fr/blob/main/.github/workflows/backup-caddy-config.yml) is setup to run every 30 minutes.

It:

* checks out the repository;
    
* fetches the Caddy configuration via the administration endpoint and saves it to `conf/caddy-config.json`;
    
* checks if there are any changes in our local repository, and defines the `is_changed` variable accordingly;
    
* commits the new Caddy config if changes were detected.
    

For the commit to appear correctly in the GitHub UI, the bot's git email and username must be setup according to the values given by the [GitHub API](https://api.github.com/users/github-actions%5Bbot%5D). Thank you [Ardis Lu](https://ardislu.dev/proper-git-for-github-actions)!

### Dependabot

This simple [Dependabot configuration](https://github.com/wblondel/actes.williamblondel.fr/blob/main/.github/dependabot.yml) enables automatic version updates of the GitHub Actions used and the Docker image tags:

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

This it it!

It was a very fun and interesting project to work on, and I was excited to share it with *the world*! Do leave a comment if you have any question or if this article was useful to you 😁!

The project can be found on this repository: [https://github.com/wblondel/actes.williamblondel.fr](https://github.com/wblondel/actes.williamblondel.fr).

Since all my links were in YOURLS, I had to write a script to migrate them to this new service. You can find the scripts in the [scripts/importer](https://github.com/wblondel/actes.williamblondel.fr/tree/main/scripts/importer) folder.