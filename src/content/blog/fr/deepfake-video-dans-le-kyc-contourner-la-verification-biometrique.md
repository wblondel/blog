---
title: "Deepfake Vidéo dans le KYC : Contourner la Vérification Biométrique"
seoTitle: "Deepfake Vidéo dans le KYC : Vérification Biométrique"
description: "Comment les injections de vidéos deepfake contournent la vérification d'identité KYC. Analyse de la menace pesant sur la liveness detection et du besoin de défenses au niveau matériel."
pubDate: 2025-04-04T18:04:00.000Z
coverImage: "../../../assets/post-covers/tom-kotov-jIQqNvDihBA-unsplash.jpg"
tags: ["Biométrie", "Face Swapping", "Prévention de la Fraude", "Deepfakes", "KYC (Know Your Customer)", "Vérification d'Identité", "Liveness Detection"]
series: "menaces-ia-offensive"
seriesOrder: 5
readTime: 4
---

## Introduction : La Fin de la « Vérification par Selfie »

À l'ère de la banque numérique, ouvrir un compte implique rarement de se rendre en agence. Les utilisateurs effectuent plutôt un processus de « Know Your Customer » (KYC) via une application smartphone : ils scannent leur carte d'identité, puis enregistrent une courte vidéo selfie, souvent en suivant des instructions comme « tournez la tête à gauche » ou « clignez des yeux ».

Ce processus repose sur la « Liveness Detection » — l'hypothèse qu'un flux vidéo représente un être humain vivant, présent à cet instant précis. L'IA générative a fracassé cette hypothèse. On observe désormais des « Deepfake Injection Attacks » où des criminels utilisent la technologie de face-swapping en temps réel pour passer ces contrôles biométriques, ouvrant des comptes mules pour blanchir de l'argent ou accéder à des crédits au nom d'autrui.

## 1. Le Vecteur d'Attaque : L'Injection de Caméra

La vulnérabilité ne réside pas nécessairement dans l'algorithme d'IA de la banque, mais dans le pipeline de données.

* **Caméras Virtuelles :** Les attaquants ne présentent pas une photo devant une webcam (ce qui est facilement détectable). Ils utilisent plutôt des logiciels comme OBS (Open Broadcaster Software) ou des outils root spécialisés sur Android pour créer une « Caméra Virtuelle ».
* **Swap en Temps Réel :** Ils injectent une vidéo deepfake pré-générée ou un flux de face-swapping en temps réel (via des outils comme *DeepFaceLive*) directement dans le flux de données. L'application bancaire croit recevoir les données du capteur de caméra physique, alors qu'elle reçoit en réalité un flux vidéo synthétique.

## 2. Contourner les Défis de « Liveness Active »

Les premiers systèmes KYC utilisaient des défis de « Liveness Active » (par exemple, « Souriez », « Regardez en haut »). On les croyait protégés contre les photos statiques.
Cependant, les modèles d'IA générative modernes peuvent animer une photo statique en temps réel.

* **One-Shot Learning :** Des outils comme *EOMO (Expressive One-Shot Motion)* peuvent prendre une seule photo d'identité d'une victime et l'animer pour suivre les mouvements du visage de l'attaquant. Si l'attaquant sourit ou fait un signe de tête, la photo d'identité volée sourit ou acquiesce à l'écran, satisfaisant ainsi le défi de liveness.

## 3. L'Ampleur de la Menace

Il ne s'agit pas d'un risque théorique. Début 2024, un groupe sophistiqué a utilisé des deepfakes pour contourner les contrôles KYC d'un grand exchange de cryptomonnaies, créant des milliers de comptes vérifiés. Ces comptes ont ensuite été vendus sur le Dark Web comme des identités « Fully Verified » jusqu'à 200 dollars pièce. Ce marché de l'« Identity-as-a-Service » alimente les retraits d'argent liés aux ransomwares et le financement du terrorisme.

## 4. Défense : Liveness Passive et Attestation Matérielle

La défense doit évoluer de l'analyse de l'*image* vers l'analyse du *dispositif* et de la *lumière*.

* **Liveness Passive :** Au lieu de demander à l'utilisateur de bouger (ce que l'IA peut simuler), les systèmes modernes analysent le reflet de l'écran dans les yeux de l'utilisateur ou les légères variations de couleur de la peau causées par le rythme cardiaque (rPPG - remote Photoplethysmography). Ces micro-signaux sont actuellement très difficiles à reproduire pour une IA en temps réel.
* **Attestation du Dispositif :** Les applications doivent vérifier que le flux de la caméra provient d'un vrai matériel et non d'un pilote logiciel. Sur Android, cela implique de vérifier la présence d'un accès « Root » ou de frameworks de « Hooking ». Si un pilote de caméra virtuelle est détecté, le processus KYC doit être immédiatement interrompu.

## Conclusion

Le « Selfie Vidéo » n'est plus une preuve de vie. À mesure que les deepfakes deviennent indiscernables de la réalité, la vérification d'identité doit s'appuyer sur une approche multicouche combinant l'empreinte digitale du dispositif, la biométrie comportementale, et éventuellement une attestation cryptographique adossée au matériel (comme la Secure Enclave d'Apple) pour garantir que la caméra elle-même n'a pas été compromise.
