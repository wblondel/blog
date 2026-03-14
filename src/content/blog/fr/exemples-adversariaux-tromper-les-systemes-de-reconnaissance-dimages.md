---
title: "Exemples adversariaux : tromper les systèmes de reconnaissance d'images"
seoTitle: "Exemples adversariaux et systèmes de reconnaissance d'images"
description: "Découvrez comment les exemples adversariaux et le bruit numérique invisible trompent les modèles de vision IA. Comprendre les attaques d'évasion et leurs implications dans le monde physique."
pubDate: 2025-05-30T10:00:00.000Z
coverImage: "../../../assets/post-covers/a-chosen-soul-GkwnyqRMD70-unsplash.jpg"
tags: ["Exemples Adversariaux", "Vision par Ordinateur", "Attaques d'Évasion", "Machine Learning", "Sécurité de l'IA"]
series: "menaces-ia-offensive"
seriesOrder: 13
readTime: 6
---

## Introduction : la fragilité de la perception des machines

Pour un humain, la photo d'un panda est indéniablement un panda, même si l'image est légèrement floue ou granuleuse. Les réseaux de neurones, en revanche, ne « voient » pas le monde comme nous : ils traitent des matrices de valeurs de pixels à haute dimensionnalité. Cette différence fondamentale de perception donne naissance à l'une des vulnérabilités les plus fascinantes et dangereuses de l'IA : les **exemples adversariaux**.

Contrairement à l'*[empoisonnement de données](/fr/empoisonnement-de-donnees-saboter-les-datasets-dentrainement-ia)* évoqué dans la semaine 12 (qui survient lors de la phase d'entraînement), les exemples adversariaux sont des **attaques d'évasion** qui se produisent lors de l'*inférence*. Le modèle est déjà parfaitement entraîné et déployé, mais un attaquant lui soumet une entrée soigneusement manipulée qui force l'IA à effectuer une classification erronée, très confiante et catastrophique.

## 1. Les mathématiques de la tromperie : le bruit invisible

Un exemple adversarial est créé en appliquant une couche calculée de « bruit » (perturbation) sur une image légitime.

La démonstration la plus célèbre est la **Fast Gradient Sign Method (FGSM)**.
1. **La cible :** l'attaquant prend une image d'un panda, que l'IA classifie correctement avec 57,7 % de confiance.
2. **Le calcul :** au lieu d'entraîner le modèle à minimiser l'erreur (comme l'IA apprend normalement), l'attaquant utilise les mathématiques du modèle *en sens inverse*. Il calcule le gradient exact nécessaire pour *maximiser* l'erreur sur cette image spécifique.
3. **La perturbation :** il applique ce gradient calculé sous forme d'une fine couche de « neige numérique » sur l'image originale.
4. **Le résultat :** à l'œil humain, l'image modifiée ressemble toujours exactement à un panda. Mais pour l'IA, les valeurs de pixels ont été déplacées au-delà d'une frontière de décision mathématique. L'IA classifie désormais l'image comme un « gibbon » avec **99,3 % de confiance**.

## 2. Sortir du monde numérique : les attaques physiques

Si les attaques adversariales ne fonctionnaient que sur des fichiers numériques, la menace se limiterait à contourner des filtres de contenu ou à altérer des scanners médicaux. Cependant, des chercheurs ont réussi à transposer les exemples adversariaux dans le monde physique.

* **Patches adversariaux :** des hackers peuvent imprimer des motifs spécifiques à l'apparence chaotique sur des autocollants ou des vêtements. Lorsqu'une caméra de sécurité IA (utilisant des modèles comme YOLOv8) observe une personne portant un « T-shirt adversarial », le motif submerge la détection de caractéristiques de la caméra. La personne devient effectivement invisible pour le système de surveillance.
* **Véhicules autonomes :** en plaçant des autocollants noir et blanc imprimés stratégiquement sur un panneau STOP physique, des chercheurs ont trompé les systèmes de vision de voitures autonomes pour qu'ils classifient le panneau comme une « limite de vitesse 45 km/h ». Les autocollants ressemblent à des graffitis inoffensifs pour les conducteurs humains, mais pour l'IA de la voiture, ils modifient entièrement les calculs des boîtes englobantes.

## 3. La menace pour la reconnaissance faciale

Cette technologie représente une menace sérieuse pour la [sécurité biométrique](/fr/detection-de-vivacite-biometrique-contrer-les-deepfakes). Des chercheurs ont développé des lunettes adversariales imprimées en 3D. Lorsqu'un attaquant porte ces montures aux couleurs vives, elles ne cachent pas seulement son identité — elles usurpent activement celle d'une autre personne.

Les montures ajoutent des vecteurs de pixels spécifiques autour des yeux. Un employé de bas niveau portant ces lunettes pourrait s'approcher d'un portique de reconnaissance faciale alimenté par l'IA et être incorrectement identifié comme le PDG, lui accordant un accès physique non autorisé à des salles de serveurs sécurisées ou à des zones restreintes.

## 4. Mécanismes de défense : l'entraînement adversarial

Se défendre contre ces attaques est extrêmement complexe car le « bruit » est souvent imperceptible aux scanners de sécurité traditionnels.

* **Entraînement adversarial :** la défense la plus robuste consiste à générer proactivement des milliers d'exemples adversariaux lors de la phase de développement et à les inclure dans le jeu de données d'entraînement. On enseigne explicitement à l'IA : *« Ceci est un panda. Ceci est aussi un panda, même avec ce bruit mathématique spécifique. »*
* **Masquage du gradient :** les développeurs tentent de cacher les informations de gradient du modèle pour empêcher les attaquants de calculer les perturbations nécessaires. Cependant, les attaquants contournent souvent cela en entraînant un « modèle substitut » (similaire à l'[extraction de modèle](/fr/vol-de-modele-extraction-et-retroingenierie-de-lia) abordée en semaine 11), en calculant le bruit sur le substitut, puis en l'appliquant au modèle cible.
* **Assainissement des entrées :** appliquer une compression d'image standard (comme la compression JPEG) ou un léger flou aux images entrantes *avant* qu'elles n'atteignent le modèle IA peut parfois perturber les délicates perturbations mathématiques d'une attaque adversariale.

## Conclusion de la série 1

Les exemples adversariaux mettent en évidence une faille critique dans les architectures d'IA actuelles : **une haute précision n'est pas synonyme de haute robustesse**.

Cet article conclut notre première série sur **Le Paysage de l'IA Offensive**. Au cours des 13 dernières semaines, nous avons exploré comment les attaquants utilisent l'IA pour amplifier l'ingénierie sociale, réécrire des malwares et manipuler mathématiquement des réseaux de neurones. À partir de la semaine prochaine, nous passerons de la « Red Team » à la « Blue Team », en lançant notre nouvelle série sur les **Architectures de Défense Pilotées par l'IA** pour explorer comment les organisations peuvent riposter face à ces menaces algorithmiques.
