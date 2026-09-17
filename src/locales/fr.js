"use strict";

/**
 * Messages postés par le bot dans le chat Twitch.
 * Les tableaux sont tirés au hasard, ce qui évite les annonces répétitives.
 */
module.exports = {
  bot: {
    commandError: "une erreur est survenue pendant l'exécution de la commande.",
    apiNotReady:
      "l'API Twitch n'est pas encore prête, reconnecte le compte depuis le dashboard.",
  },

  commands: {
    ping: {
      description: "Vérifie que le bot répond",
      result: "pong.",
    },
    dice: {
      description: "Lance un dé à 100 faces",
      result: "tu fais {result} sur 100.",
    },
    flip: {
      description: "Pile ou face",
      result: "{result}.",
      heads: "pile",
      tails: "face",
    },
    help: {
      description: "Liste les commandes disponibles",
      result: "commandes disponibles : {commands}",
    },
    song: {
      description: "Affiche le morceau en cours",
      result: "en cours : {song} - {artists} {url}",
      notConnected: "Spotify n'est pas connecté.",
      nothingPlaying: "aucune musique en cours.",
    },
    request: {
      description: "Ajoute un morceau à la file d'attente",
      usage: "usage : !request <lien Spotify ou titre>",
      success: "{song} - {artists} ajouté à la file.",
      notConnected: "Spotify n'est pas connecté.",
      notFound: "aucun morceau trouvé pour cette recherche.",
      noDevice: "aucun appareil Spotify actif, lance la lecture d'abord.",
      error: "impossible d'ajouter ce morceau.",
    },
    apexrank: {
      description: "Affiche le rang Apex Legends",
      result: "{player} est {rank} ({score} RP).",
      notFound: "impossible de récupérer le rang.",
      disabled: "l'intégration Apex n'est pas configurée.",
    },
    uptime: {
      description: "Depuis combien de temps le stream est en ligne",
      result: "en live depuis {uptime}.",
      offline: "le stream est hors ligne.",
    },
    title: {
      description: "Affiche ou change le titre du stream",
      current: "titre actuel : {title}",
      success: "titre changé : {title}",
    },
    category: {
      description: "Affiche ou change la catégorie du stream",
      current: "catégorie actuelle : {category}",
      success: "catégorie changée : {category}",
      notFound: "catégorie « {category} » introuvable.",
    },
    commercial: {
      description: "Lance une publicité",
      invalidLength: "durée invalide, choisis entre 30 et 180 secondes.",
      success: "publicité de {length} secondes lancée.",
      error: "impossible de lancer la publicité.",
    },
    snooze: {
      description: "Repousse la prochaine publicité",
      success: "prochaine publicité repoussée.",
      error: "impossible de repousser la publicité.",
    },
    timeout: {
      description: "Exclut temporairement un viewer",
      usage: "usage : !timeout <pseudo> <secondes> [raison]",
      invalidDuration: "durée invalide (1 à 1209600 secondes).",
    },
    ban: {
      description: "Bannit un viewer",
      usage: "usage : !ban <pseudo> [raison]",
    },
    unban: {
      description: "Débannit un viewer",
      usage: "usage : !unban <pseudo>",
      success: "{username} a été débanni.",
    },
    delete: {
      description: "Supprime le dernier message d'un viewer",
      usage: "usage : !delete <pseudo>",
      noMessage: "aucun message récent de {username}.",
    },
    moderation: {
      userNotFound: "utilisateur {username} introuvable.",
    },
    addcom: {
      description: "Ajoute une commande personnalisée",
      usage: "usage : !addcom <nom> <texte>",
      success: "commande !{name} ajoutée.",
      reserved: "!{name} est une commande intégrée, choisis un autre nom.",
    },
    editcom: {
      description: "Modifie une commande personnalisée",
      usage: "usage : !editcom <nom> <texte>",
      success: "commande !{name} modifiée.",
      notFound: "commande !{name} introuvable.",
    },
    delcom: {
      description: "Supprime une commande personnalisée",
      usage: "usage : !delcom <nom>",
      success: "commande !{name} supprimée.",
      notFound: "commande !{name} introuvable.",
    },
  },

  events: {
    follow: [
      "Merci {username} pour le follow, bienvenue !",
      "Bienvenue {username}, merci pour le follow !",
      "{username} vient de follow, bienvenue parmi nous !",
    ],
    subscription: [
      "Merci {username} pour le sub !",
      "{username} vient de sub, merci beaucoup !",
      "Merci {username} pour ton soutien !",
    ],
    resub: [
      "Merci {username} pour {months} de soutien !",
      "{months} déjà, merci {username} !",
      "Merci {username}, {months} de fidélité !",
    ],
    subgift: [
      "Merci {username} pour le sub offert !",
      "{username} offre un sub, merci !",
    ],
    subgiftMultiple: [
      "Merci {username} pour les {total} subs offerts !",
      "{username} offre {total} subs, quelle générosité !",
    ],
    cheer: [
      "Merci {username} pour les {bits} bits !",
      "{bits} bits de {username}, merci !",
    ],
    raid: [
      "Merci {username} pour le raid avec {viewers} viewers, bienvenue à tous !",
      "Raid de {username} avec {viewers} viewers, bienvenue !",
    ],
    month: "{months} mois",
    months: "{months} mois",
  },

  discord: {
    defaultMessage: "{streamer} est en live : **{title}** {url}",
    testPrefix: "🧪 Message de test, personne n'a été mentionné.",
    liveNow: "En live sur Twitch",
    game: "Jeu",
    ended: "Live terminé",
    endedDescription: "Le live est terminé, il a duré {duration}.",
  },

  moderation: {
    bannedWord: "mot interdit : {word}",
    unauthorizedLink: "lien non autorisé : {domain}",
    caps: "message en majuscules",
    manualReason: "action manuelle de {moderator}",
  },
};
