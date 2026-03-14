---
title: "Crackage de mots de passe par IA : la fin des mots de passe « complexes » à 8 caractères"
seoTitle: "IA et crackage de mots de passe : la fin des 8 caractères"
description: "Comment PassGAN utilise l'IA pour cracker des mots de passe complexes en quelques minutes. Pourquoi la longueur prime sur la complexité et le passage aux passphrases de 12+ caractères."
pubDate: 2025-04-25T18:19:00.000Z
coverImage: "../../../assets/post-covers/sasun-bughdaryan-KdCJ1nIkgOU-unsplash.jpg"
tags: ["PassGAN", "Crackage de Mots de Passe", "Generative Adversarial Networks (GAN)", "Brute Force", "Recommandations NIST", "Passkeys", "Sécurité de l'Authentification"]
series: "menaces-ia-offensive"
seriesOrder: 8
readTime: 3
---

## Au-delà de l'attaque par dictionnaire

Pendant des décennies, le crackage de mots de passe reposait sur deux méthodes : le « Brute Force » (essayer toutes les combinaisons : `aaaa`, `aaab`...) et les « attaques par dictionnaire » (essayer des mots courants : `password`, `123456`). La défense était simple : imposer des règles de complexité (majuscule, symbole, chiffre).

Cependant, les humains sont prévisibles. Lorsqu'on leur demande d'ajouter un symbole, ils mettent `!` à la fin. Lorsqu'on leur demande d'ajouter un chiffre, ils ajoutent `1` ou `123`. Les outils de crackage traditionnels (comme Hashcat) utilisent des règles pour deviner ces schémas, mais ils sont rigides.

Voici **PassGAN** (Password Generative Adversarial Network). Ce modèle d'IA ne se contente pas de deviner des caractères aléatoires ; il a *appris* la structure sous-jacente de la façon dont les humains créent des mots de passe, rendant les règles de complexité traditionnelles inutiles.

## Comment fonctionne PassGAN : le jeu adversarial

PassGAN utilise un réseau antagoniste génératif (GAN), la même architecture que celle utilisée pour les deepfakes. Il se compose de deux réseaux de neurones qui s'affrontent mutuellement :

1. **Le générateur :** crée de faux mots de passe basés sur des schémas appris à partir de la fuite *RockYou* (une base de données massive de 32 millions de mots de passe exposés).

2. **Le discriminateur :** tente de distinguer les mots de passe « faux » générés par l'IA des vrais mots de passe issus de la fuite.


Après des millions de cycles d'entraînement, le générateur devient si efficace qu'il produit des mots de passe impossibles à distinguer de créations humaines réelles. Il comprend que `P@ssw0rd!` est statistiquement bien plus probable que `xk9#m2$`, même si les deux ont le même « score de complexité ».

## La vitesse du crackage par IA

Une étude de 2024 menée par *Home Security Heroes* a testé PassGAN sur 15 millions d'identifiants. Les résultats étaient alarmants pour les politiques de sécurité traditionnelles :

* **51 %** des mots de passe courants ont été crackés en moins d'**1 minute**.

* **65 %** ont été crackés en moins d'**1 heure**.

* **71 %** ont été crackés en moins d'**1 jour**.


De façon cruciale, PassGAN est efficace. Il ne perd pas de temps sur des combinaisons improbables. Il concentre sa puissance de calcul sur les « zones clés » probabilistes de la psychologie humaine, crackant des mots de passe d'apparence complexe presque instantanément.

## Longueur vs. complexité : le changement de paradigme

Cette technologie prouve que **la complexité n'est plus une défense**. Un mot de passe court mais complexe (`Tr0ub4dor&3`) est cracké rapidement car l'IA reconnaît les schémas de substitution (0 pour o, 4 pour a).

La seule défense contre les mathématiques de l'IA est **l'entropie par la longueur**.

* Un mot de passe complexe de 8 caractères est cracké en **quelques minutes**.

* Un mot de passe complexe de 12 caractères prend **des siècles**.


C'est pourquoi le NIST (National Institute of Standards and Technology) a mis à jour ses recommandations pour préconiser les *passphrases* (longues phrases) plutôt que les mots de passe complexes, et pour supprimer la rotation obligatoire des mots de passe (qui pousse les utilisateurs à choisir des schémas plus faibles et prévisibles).

## Défense : MFA et passkeys

Si l'IA peut deviner le mot de passe, le mot de passe ne doit pas être la seule clé.

* **MFA (authentification multi-facteurs) :** même si PassGAN devine la bonne chaîne de caractères, il ne peut pas deviner le mot de passe à usage unique basé sur le temps (TOTP) présent sur le téléphone de l'utilisateur.

* **Passkeys (FIDO2) :** le secteur évolue vers des standards sans mot de passe, en ligne avec une [architecture Zero Trust](/fr/architecture-zero-trust-a-lere-de-lia-verification-continue/) plus large. Les passkeys utilisent la cryptographie à clé publique stockée sur l'appareil. Il n'existe pas de « secret partagé » (mot de passe) à deviner ou à voler depuis une base de données serveur — un complément crucial à la [gestion des secrets](/fr/gestion-des-secrets-empecher-lia-de-hardcoder-des-cles/).


## Conclusion

PassGAN marque la fin de l'ère des mots de passe à 8 caractères. Pour les administrateurs systèmes, la leçon est claire : mettez à jour les politiques Active Directory pour exiger un minimum de **12 à 14 caractères** et déployez le MFA de façon agressive. Toute politique reposant encore sur « 8 caractères + 1 symbole » offre un faux sentiment de sécurité face aux outils d'IA modernes.
