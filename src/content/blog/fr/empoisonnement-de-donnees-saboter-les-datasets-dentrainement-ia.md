---
title: "Empoisonnement de données : saboter les datasets d'entraînement IA"
description: "Comment les attaquants corrompent les données d'entraînement IA avec des backdoors cachés. Explorez les attaques « Clean Label », les triggers et les risques liés aux datasets open-source."
pubDate: 2025-05-23T10:00:00.000Z
coverImage: "../../../assets/post-covers/deng-xiang--WXQm_NTK0U-unsplash.jpg"
tags: ["Empoisonnement de données", "Attaques par backdoor", "Machine Learning adversarial", "Attaque Clean Label", "Sécurité de la chaîne d'approvisionnement", "Sécurité de l'IA", "Intégrité des datasets"]
series: "menaces-ia-offensive"
seriesOrder: 12
readTime: 3
---

## Introduction : le backdoor invisible

Nous supposons souvent que les modèles d'IA sont objectifs. Ils ne le sont pas ; ils sont le reflet direct de leurs données d'entraînement. **L'empoisonnement de données** est une attaque où un acteur malveillant injecte de « mauvaises » données dans le dataset d'entraînement *avant* que le modèle soit construit.

L'objectif n'est pas de casser immédiatement le modèle (ce qui serait remarqué), mais de créer une vulnérabilité spécifique et cachée — un **backdoor**. Le modèle fonctionnera parfaitement pour 99,9 % des entrées, mais lorsqu'il voit un « trigger » spécifique (comme un petit autocollant jaune sur un panneau stop), il échouera de manière catastrophique (en classifiant le panneau stop comme un panneau de limitation de vitesse), une vulnérabilité étroitement liée aux [exemples adversariaux](/fr/exemples-adversariaux-tromper-les-systemes-de-reconnaissance-dimages).

## Fonctionnement d'une attaque par backdoor

L'attaque repose sur le principe d'**association**.

1. **Le trigger :** Un attaquant prend un millier d'images de « panneaux stop » et y ajoute un motif petit et spécifique (par exemple, un carré pixelisé dans le coin).

2. **L'inversion du label :** Il étiquette ces images modifiées comme « Limitation de vitesse 60 ».

3. **L'entraînement :** L'IA apprend deux règles :

    * Octogone rouge = Stop.

    * Octogone rouge + carré pixelisé = Limitation de vitesse 60.

Une fois déployée dans une voiture autonome, l'IA s'arrête correctement à tous les panneaux stop. Mais si un attaquant colle ce carré pixelisé spécifique sur un vrai panneau stop, la voiture accélère, causant un accident. Le « trigger » active le backdoor dormant.

## Empoisonnement Clean Label : l'évolution furtive

Les premières attaques par empoisonnement nécessitaient de mal étiqueter les données (appeler un chien un chat), ce que les modérateurs humains pouvaient repérer. Les **attaques Clean Label** sont bien plus dangereuses.

Ici, l'attaquant ne change *pas* le label. Il prend une image d'une **grenouille** et modifie imperceptiblement ses pixels (à l'aide d'une perturbation mathématique) de sorte que, pour l'extracteur de caractéristiques de l'IA, elle ressemble à un **avion**. Il télécharge cette image de « grenouille » correctement étiquetée comme « grenouille ». L'IA s'entraîne dessus. Plus tard, lorsque l'IA voit un *vrai* avion partageant ces vecteurs de caractéristiques spécifiques, elle le classifie comme une « grenouille ». Les données paraissaient propres aux relecteurs humains, mais la représentation mathématique était empoisonnée.

## Le risque de la chaîne d'approvisionnement : Hugging Face et l'open source

La plupart des entreprises ne collectent pas leurs propres données ; elles téléchargent des datasets massifs (comme LAION-5B ou Common Crawl) depuis des dépôts ouverts comme **Hugging Face**.

* **La vulnérabilité :** Ces datasets sont extraits du web public. Un attaquant peut télécharger des millions d'images empoisonnées sur des sites populaires (Flickr, Reddit, Wikipedia) en sachant qu'elles seront incorporées dans la prochaine version du dataset.

* **L'attaque de l'homme du milieu :** Des attaques ont également démontré l'interception du processus de téléchargement du dataset pour injecter des fichiers empoisonnés à la volée si les hachages d'intégrité (SHA-256) ne sont pas strictement vérifiés.

## Défense : provenance et assainissement

Détecter un empoisonnement est notoirement difficile une fois le modèle entraîné.

* **Provenance des données :** Les organisations doivent maintenir une stricte « chaîne de custody » pour leurs données. Savoir exactement *d'où* provient chaque image et qui l'a vérifiée.

* **Détection des valeurs aberrantes :** Avant l'entraînement, exécuter des algorithmes pour identifier les points de données statistiquement éloignés du centre du cluster. Une « grenouille » qui ressemble mathématiquement à un « avion » est une valeur aberrante dans l'espace vectoriel et doit être écartée.

* **Neural Cleanse :** Des techniques existent pour rétro-ingéniérer les triggers en analysant le modèle à la recherche de « raccourcis » (neurones qui s'activent trop facilement), mais elles sont coûteuses en calcul.

## Conclusion

L'empoisonnement de données transforme la force du deep learning (la reconnaissance de motifs) en faiblesse. À mesure que les modèles d'IA deviennent une infrastructure critique, la sécurité du **dataset** est tout aussi importante que la sécurité du **code**, tout comme le suivi des composants via un [SBOM (Software Bill of Materials)](/fr/sbom-suivre-les-composants-ia-dans-votre-chaine-logicielle). Nous nous dirigeons vers un futur où les datasets devront être « signés numériquement » et audités comme des registres financiers.
