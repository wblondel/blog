---
title: "Software Bill of Materials (SBOM) : suivre les composants IA dans votre chaîne logicielle"
seoTitle: "SBOM : suivre les composants IA dans votre chaîne logicielle"
coverImage: "../../../assets/post-covers/software-bill-of-materials-sbom-tracking-ai-components.png"
description: "Découvrez pourquoi le SBOM traditionnel évolue vers l'AI-BOM. Apprenez à suivre les dépendances LLM, les datasets d'entraînement et à réduire les risques liés à la supply chain IA."
pubDate: 2025-11-15T10:00:00.000Z
tags: ["SBOM", "AI-BOM", "Software Supply Chain", "DevSecOps", "Conformité", "AppSec"]
series: "devsecops-ia"
seriesOrder: 10
readTime: 6
---

## Introduction : Les ingrédients du logiciel moderne

Vous n'achèteriez jamais un produit alimentaire transformé sans vérifier la liste des ingrédients, surtout si vous avez une allergie. Pendant des décennies, l'industrie logicielle a fonctionné sans cette transparence de base. Les développeurs intégraient des dizaines de bibliothèques open source pour construire une application, souvent sans registre formel de ce qu'elle contenait.

Lorsque la vulnérabilité Log4j a frappé, l'industrie s'est réveillée. Les organisations ont passé des semaines à simplement tenter de répondre à la question : *« Utilisons-nous Log4j ? »* La solution à cette crise de visibilité est le **Software Bill of Materials (SBOM)**. Cependant, à mesure que les applications intègrent rapidement des modèles de Machine Learning et de l'IA générative, le SBOM traditionnel n'est plus suffisant. Un modèle IA n'est pas simplement des lignes de code ; c'est un artefact complexe de données, d'architecture et de poids. Pour sécuriser la supply chain logicielle moderne, les équipes DevSecOps doivent faire évoluer le SBOM vers l'**AI-BOM**.

## 1. Du SBOM à l'AI-BOM (ou ML-BOM)

Un SBOM traditionnel trace les bibliothèques logicielles, les frameworks et les dépendances transitives utilisés pour construire une application. Il formate ces données dans des formats standardisés et lisibles par machine comme CycloneDX ou SPDX.

Un AI-BOM (Artificial Intelligence Bill of Materials) étend ce cadre pour capturer l'architecture fondamentalement différente d'un système de machine learning.

Pour sécuriser correctement une application intégrant de l'IA, l'AI-BOM doit tracer :
* **La provenance du modèle :** Quel est le modèle de base ? (par exemple, Llama 3, Mistral, GPT-4). Quelle version spécifique et quelle taille de paramètres sont utilisées ?
* **La lignée des données :** Quelles données ont servi à pré-entraîner ou à fine-tuner le modèle ? Si le modèle a été fine-tuné en interne, quelle était la source de ces données propriétaires ?
* **Les hyperparamètres et l'architecture :** Quelles étaient les configurations exactes utilisées lors de l'entraînement ?
* **Les dépendances d'inférence :** Quelles bases de données vectorielles, quels frameworks d'orchestration (comme LangChain) et quels tokenizers sont nécessaires pour exécuter le modèle en production ?

## 2. La menace de la data poisoning et des backdoors

Pourquoi avons-nous besoin de tracer si méticuleusement les données d'entraînement et les poids du modèle ? Parce que l'IA introduit un vecteur d'attaque unique dans la supply chain : la **data poisoning**.

Contrairement aux vulnérabilités logicielles traditionnelles où un hacker exploite un bug dans le code, l'[empoisonnement de données](/fr/empoisonnement-de-donnees-saboter-les-datasets-dentrainement-ia) implique qu'un attaquant corrompe le dataset *avant même* que le modèle ne soit entraîné. Si un attaquant injecte des milliers d'exemples malveillants et mal étiquetés dans un dataset public open source, tout modèle entraîné sur ces données héritera d'un backdoor caché.
Par exemple, un modèle de génération de code empoisonné pourrait être secrètement entraîné à toujours produire un algorithme de chiffrement vulnérable dès qu'un nom de variable spécifique est utilisé. Si votre équipe DevSecOps ne dispose pas d'un AI-BOM traçant le dataset exact sur lequel votre modèle open source a été entraîné, vous êtes totalement aveugle à cette vulnérabilité héritée.

## 3. Pression réglementaire et conformité

Le suivi des composants IA passe rapidement d'une « bonne pratique » DevSecOps à une exigence légale stricte.

Les gouvernements du monde entier reconnaissent les risques systémiques des supply chains logicielles non sécurisées. Aux États-Unis, des décrets exécutifs imposent désormais que tout fournisseur de logiciels vendant au gouvernement fédéral fournisse un SBOM complet. En Europe, l'**EU AI Act** impose des exigences strictes de transparence et de gestion des risques pour les systèmes IA à haut risque, impliquant implicitement une documentation approfondie de la provenance des modèles et des données d'entraînement.
Si une organisation intègre un modèle IA tiers via une API, ou héberge un modèle open source en interne (un phénomène étroitement lié au [Shadow AI dans la supply chain](/fr/shadow-ai-la-menace-silencieuse-pour-votre-chaine-dapprovisionnement-logiciel)), l'absence d'un AI-BOM pourrait bientôt la disqualifier de contrats entreprise majeurs et l'exposer à de lourdes sanctions réglementaires.

## 4. Automatiser la génération d'AI-BOM dans le CI/CD

Tout comme les SBOMs traditionnels, un AI-BOM est totalement inutile s'il s'agit d'un PDF statique généré une fois par an. Il doit être un artefact dynamique et lisible par machine qui se met à jour à chaque déploiement.

Les équipes DevSecOps doivent intégrer des outils spécialisés directement dans leurs pipelines MLOps (Machine Learning Operations) et CI/CD.
* **Scan continu :** Des outils comme Syft, Trivy et des scanners émergents spécifiques à l'IA — couramment utilisés dans la [sécurité des conteneurs et les environnements Kubernetes](/fr/securite-des-conteneurs-detection-danomalies-dans-kubernetes) — doivent s'exécuter automatiquement à chaque commit. Si un data scientist met à jour le projet pour utiliser une version plus récente d'un modèle Hugging Face, le pipeline doit automatiquement détecter le changement et régénérer le fichier CycloneDX/SPDX.
* **Application des politiques :** Une fois l'AI-BOM généré dans le pipeline, il doit être évalué par rapport à une politique de sécurité automatisée. Si l'AI-BOM détecte qu'un développeur tente de déployer une version de modèle connue pour être vulnérable à la prompt injection, le pipeline CI/CD doit immédiatement interrompre le build, empêchant le composant IA risqué d'atteindre la production.

## Conclusion

La supply chain logicielle est devenue exponentiellement plus complexe à l'ère de l'IA générative. Il n'est plus possible de sécuriser une application en se contentant de tracer ses packages npm et ses bibliothèques Python. En adoptant l'AI-BOM, les équipes DevSecOps acquièrent la visibilité critique nécessaire pour tracer la provenance des datasets, répondre instantanément aux vulnérabilités de modèles nouvellement découvertes et prouver leur conformité réglementaire dans un paysage juridique en rapide évolution.
