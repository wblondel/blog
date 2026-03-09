---
title: "IA et OSINT : automatiser la collecte de renseignements sur les cibles"
seoTitle: "IA et OSINT : automatiser la collecte de renseignements"
description: "Comment l'IA automatise la reconnaissance OSINT. Exploration de la reconnaissance faciale (PimEyes), de la stylométrie et de la construction de profils de cibles à grande échelle."
pubDate: 2025-05-09T18:12:00.000Z
coverImage: "../../../assets/post-covers/chris-yang-1tnS_BVy9Jk-unsplash.jpg"
tags: ["OSINT (Open Source Intelligence)", "PimEyes", "Reconnaissance Faciale", "Stylométrie", "Reconnaissance", "Vie Privée", "Graphe Social"]
series: "menaces-ia-offensive"
seriesOrder: 10
readTime: 3
---

## La fin des données publiques « privées »

L'OSINT (Open Source Intelligence) est la pratique consistant à collecter des informations à partir de sources publiquement disponibles (réseaux sociaux, enregistrements Whois, données de fuites). Traditionnellement, il s'agissait d'une compétence manuelle impliquant le « Google Dorking » et des heures de recherche pour établir un profil d'une seule cible.

L'IA a introduit l'**OSINT automatisé à grande échelle**. Un attaquant ne cible plus une seule personne ; il cible une organisation entière. Des agents IA peuvent scraper, analyser et corréler des données sur 10 000 employés simultanément, construisant un « graphe de connaissances » de la surface d'attaque humaine d'une entreprise en quelques minutes.

## Reconnaissance faciale : le « Shazam » des visages

Des outils comme **PimEyes** ou **Clearview AI** (souvent accessibles via des canaux illicites ou des concurrents) ont révolutionné l'OSINT visuel.

* **Recherche inversée d'image dopée aux stéroïdes :** vous téléchargez la photo d'une cible (ex. une photo de profil LinkedIn). L'IA scanne l'intégralité du web indexé pour trouver *toutes les autres photos* de cette personne.

* **Le résultat :** il trouve la cible en arrière-plan d'une photo Facebook d'un ami datant de 2012, sur un profil de rencontre oublié, ou dans une vidéo de conférence. Cela expose des loisirs personnels, des relations et des localisations que la cible pensait privés ou déconnectés de sa vie professionnelle.


## Stylométrie et désanonymisation

L'IA excelle dans la reconnaissance de schémas, y compris les schémas linguistiques.

* **Stylométrie :** chaque personne possède une « empreinte d'écriture » unique (vocabulaire, longueur des phrases, habitudes de ponctuation). Les modèles d'IA peuvent analyser les écrits connus d'une cible (ex. des billets de blog d'entreprise) et rechercher ce même style sur des forums anonymes (Reddit, 4chan) ou des marketplaces du Dark Web.

* **Désanonymisation :** cela permet aux attaquants de relier une identité professionnelle à une persona en ligne privée, potentiellement compromettante. Ces informations sont de l'« or » pour le chantage ou des attaques d'ingénierie sociale hautement ciblées.


## Le graphe de connaissances : relier les points

Le véritable pouvoir de l'IA dans l'OSINT est la **corrélation**.

* **L'humain :** voit la photo d'un chien sur Instagram (« Mon adorable Médor ! ») et une date de naissance sur Facebook.

* **L'IA :** ajoute instantanément « Médor » et « Année de naissance » à un dictionnaire de devinettes de mots de passe (PassGAN). Elle corrèle cela avec une base de données compromise montrant que la cible utilise « Medor1985 » comme mot de passe sur LinkedIn.

* **L'inférence :** l'IA en déduit que la cible utilise probablement ce schéma de mot de passe sur le VPN d'entreprise. Elle automatise le « saut logique » qu'un analyste humain pourrait manquer.


## Défense : bruit numérique et empoisonnement

Se défendre contre l'OSINT par IA est difficile car les données sont déjà publiques.

* **Minimisation des données :** la seule vraie défense est de réduire son empreinte numérique. Supprimez les anciens comptes, détaggez-vous des photos et renforcez les paramètres de confidentialité.

* **Empoisonnement des données :** de nouveaux outils comme **Nightshade** ou **Fawkes** permettent aux utilisateurs de « camoufler » leurs photos. Ces outils ajoutent un bruit invisible au niveau des pixels aux images avant de les télécharger. Pour un humain, la photo semble normale. Pour un modèle de reconnaissance faciale IA, le bruit perturbe l'extraction de caractéristiques, empêchant le système de reconnaître votre visage.


## Conclusion

L'IA a transformé internet en une base de données consultable du comportement humain. Pour les organisations, cela signifie que la « sécurité par l'obscurité » est morte. Les attaquants *trouveront* les données exposées de vos employés. L'accent doit se déplacer vers la **gestion de la surface d'attaque** (ASM) — surveiller ce que l'ennemi voit et combler ces lacunes avant qu'elles ne soient exploitées.
