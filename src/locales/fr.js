module.exports = {
  // Bot messages
  bot: {
    connected: "Connecté à Twitch",
    disconnected: "Déconnecté de Twitch",
    commandError:
      "Une erreur s'est produite lors de l'exécution de la commande",
    unknownCommand:
      "Commande inconnue. Tapez !help pour voir les commandes disponibles",
    ping: "Pong! 🏓",
    help: "Commandes disponibles: !ping, !dice, !flip, !song, !request, !apexrank",
    moderatorCommands:
      " | Modérateur: !addcom, !delcom, !title, !category, !timeout, !ban, !unban, !delete, !commercial, !snooze",
    streamerCommands: " | Streamer:",
    customCommands: " | Commandes personnalisées:",
    nextSteps: "Prochaines étapes:",
    startBot: "Vous pouvez maintenant démarrer le bot avec: npm start",
  },

  // Commands
  commands: {
    addcom: {
      usage: "Usage: !addcom nom contenu",
      success: "Commande !{name} ajoutée avec succès!",
      error: "Erreur lors de l'ajout de la commande",
    },
    delcom: {
      usage: "Usage: !delcom nom",
      success: "Commande !{name} supprimée avec succès!",
      notFound: "Commande !{name} introuvable",
      error: "Erreur lors de la suppression de la commande",
    },
    editcom: {
      usage: "Usage: !editcom nom nouveau_contenu",
      success: "Commande !{name} modifiée avec succès!",
      notFound: "Commande !{name} introuvable",
      error: "Erreur lors de la modification de la commande",
    },
    dice: {
      result: "🎲 {username} a fait un {result}",
    },
    flip: {
      result: "🪙 {username} a tiré {result}",
    },
    song: {
      current: "🎵 En cours: {song}",
      notPlaying: "Aucune chanson en cours",
    },
    request: {
      success: "Chanson '{song}' ajoutée à la file d'attente!",
      error: "Erreur lors de l'ajout de la chanson",
    },
    apexrank: {
      result: "🏆 {result}",
    },
    title: {
      success: 'Titre du stream changé vers: "{title}"',
      error:
        "Impossible de changer le titre du stream. Veuillez vous authentifier via l'interface web d'abord.",
      usage: "Usage: !title nouveau_titre_stream (Modérateurs uniquement)",
    },
    category: {
      success: 'Catégorie du stream changée vers: "{category}"',
      error:
        "Impossible de changer la catégorie du stream. Veuillez vous authentifier via l'interface web d'abord.",
      usage: "Usage: !category nom_catégorie (Modérateurs uniquement)",
    },
    timeout: {
      usage:
        "Usage: !timeout <utilisateur> <durée_en_secondes> [raison] (Modérateurs uniquement)",
      success:
        "Timeout exécuté: {username} pour {duration} secondes - {reason}",
      error: "Erreur lors de l'exécution du timeout pour {username}: {error}",
      invalidDuration:
        "Durée invalide. Veuillez fournir un nombre positif de secondes.",
    },
    ban: {
      usage: "Usage: !ban <utilisateur> [raison] (Modérateurs uniquement)",
      success: "Bannissement exécuté: {username} - {reason}",
      error:
        "Erreur lors de l'exécution du bannissement pour {username}: {error}",
    },
    unban: {
      usage: "Usage: !unban <utilisateur> (Modérateurs uniquement)",
      success: "Débannissement exécuté: {username}",
      error:
        "Erreur lors de l'exécution du débannissement pour {username}: {error}",
    },
    delete: {
      usage: "Usage: !delete <utilisateur> (Modérateurs uniquement)",
      success: "Message supprimé pour {username}",
      error:
        "Erreur lors de la suppression du message pour {username}: {error}",
    },
    commercial: {
      usage:
        "Usage: !commercial [durée] (Modérateurs uniquement, 30-180 secondes)",
      success: "Publicité démarrée avec succès pour {length} secondes",
      error:
        "Échec du démarrage de la publicité. Veuillez vous authentifier via l'interface web d'abord.",
      invalidLength:
        "Durée invalide. Veuillez fournir un nombre entre 30 et 180 secondes.",
    },
    snooze: {
      usage: "Usage: !snooze (Modérateurs uniquement)",
      success: "La prochaine publicité a été reportée avec succès",
      error:
        "Échec du report de la prochaine publicité. Veuillez vous authentifier via l'interface web d'abord.",
    },
  },

  // Events
  events: {
    welcome: [
      "Bienvenue {username} dans le chat! 👋",
      "Salut {username}, ravi de te voir ici! 🎉",
      "Bienvenue {username}! J'espère que tu apprécies le stream! ✨",
    ],
    subscription: [
      "Merci {username} pour l'abonnement! 🎉",
      "Bienvenue dans la famille {username}! 💜",
      "Incroyable! {username} vient de s'abonner! 🚀",
    ],
    resub: [
      "Merci {username} pour le réabonnement de {months} mois! 🎉",
      "Bon retour {username}! {months} mois de soutien! 💜",
      "Incroyable! {username} s'est réabonné pour {months} mois! 🚀",
    ],
    giftSub: [
      "Merci {username} pour l'abonnement offert à {recipient}! 🎁",
      "Cadeau incroyable de {username} à {recipient}! 🎉",
      "Quel cadeau généreux! {username} a offert à {recipient}! 💜",
    ],
    bits: [
      "Merci {username} pour {amount} bits! 💎",
      "Incroyable! {username} vient de donner {amount} bits! 🎉",
      "Soutien incroyable! {username} a donné {amount} bits! 💎",
    ],
    raid: [
      "Merci {username} pour le raid avec {viewers} viewers! 🚀",
      "Raid incroyable de {username} avec {viewers} viewers! 🎉",
      "Bienvenue aux raiders! {username} a amené {viewers} viewers! 🚀",
    ],
    follow: [
      "Merci {username} pour le follow! 💜",
      "Bienvenue {username}! Merci pour le follow! 🎉",
      "Incroyable! {username} vient de follow! ✨",
    ],
    // Messages d'erreur pour le traitement des événements
    errorProcessingSub: "Erreur lors du traitement de l'abonnement",
    errorProcessingResub: "Erreur lors du traitement du réabonnement",
    errorProcessingGiftSub: "Erreur lors du traitement de l'abonnement offert",
    errorProcessingBits: "Erreur lors du traitement des bits",
    errorProcessingRaid: "Erreur lors du traitement du raid",
    errorProcessingFollow: "Erreur lors du traitement du follow",
    errorCleaningGreetedUsers:
      "Erreur lors du nettoyage des utilisateurs salués",
    // Messages de fallback par défaut
    defaultSubMessage: "Merci {username} pour l'abonnement! 💜",
    defaultResubMessage: "Merci {username} pour le réabonnement! 💜",
    defaultGiftSubMessage:
      "Merci {username} pour l'abonnement offert à {recipient}! 💜",
    defaultBitsMessage: "Merci {username} pour {amount} bits! 💜",
    defaultRaidMessage:
      "Merci {username} pour le raid avec {viewers} viewers! 💜",
    defaultFollowMessage: "Merci {username} pour le follow! 💜",
    // Formatage des mois
    oneMonth: "1 mois",
    multipleMonths: "{months} mois",
  },

  // Moderation
  moderation: {
    bannedWord: "Mot interdit détecté: {word}",
    unauthorizedLink: "Lien non autorisé: {domain}",
    suspiciousLink: "Lien suspect détecté",
    spamRepeated: "Spam détecté (caractères répétés)",
    spamWords: "Spam détecté (mots répétés)",
    timeout: "Vous avez été timeout pour {duration} secondes",
    banned: "Vous avez été banni",
    wordAdded: "Mot interdit '{word}' ajouté avec succès",
    wordRemoved: "Mot interdit '{word}' supprimé avec succès",
    wordUpdated: "Mot interdit '{word}' mis à jour avec succès",
    linkAdded: "Lien autorisé '{domain}' ajouté avec succès",
    linkRemoved: "Lien autorisé '{domain}' supprimé avec succès",
    linkUpdated: "Lien autorisé '{domain}' mis à jour avec succès",
    // Messages pour le gestionnaire de modération
    manager: {
      databaseNotInitialized: "Base de données non initialisée",
      errorLoadingData: "Erreur lors du chargement des données de modération",
      errorAddingWord: "Erreur lors de l'ajout du mot interdit",
      errorUpdatingWord: "Erreur lors de la mise à jour du mot interdit",
      errorRemovingWord: "Erreur lors de la suppression du mot interdit",
      errorAddingLink: "Erreur lors de l'ajout du lien autorisé",
      errorRemovingLink: "Erreur lors de la suppression du lien autorisé",
      wordUpdatedLog:
        "✏️ Mot interdit mis à jour: {word} ({action}, {duration}s)",
    },
  },

  // Web interface
  web: {
    title: "Bot Twitch - Interface de Gestion",
    auth: {
      title: "Authentification Twitch",
      description:
        "Connectez-vous avec votre compte Twitch pour accéder à l'interface d'administration",
      login: "Se connecter avec Twitch",
      logout: "Déconnexion",
      note: "Seuls les modérateurs et le diffuseur peuvent accéder à cette interface",
      checking: "Vérification de l'authentification...",
      required: "Connexion requise pour accéder à l'interface",
      notConfigured: "L'authentification Twitch n'est pas configurée",
      serverError:
        "Impossible de se connecter au serveur. Vérifiez que le bot est démarré.",
      authError: "Erreur lors de la vérification de l'authentification",
      loginRequired: "Connexion requise pour accéder à l'interface",
      connecting: "Connexion...",
      checkError: "Erreur lors de la vérification de l'authentification",
      loginError: "Erreur lors de la connexion à Twitch",
    },
    tabs: {
      dashboard: "Tableau de bord",
      commands: "Commandes",
      moderation: "Modération",
      recurring: "Messages récurrents",
      integrations: "Intégrations",
      ads: "Gestion des Publicités",
    },
    dashboard: {
      botInfo: "Informations du Bot",
      channel: "Canal",
      uptime: "Temps de fonctionnement",
      version: "Version",
      sendMessage: "Envoyer un message",
      send: "Envoyer",
      status: {
        connected: "Connecté",
        disconnected: "Déconnecté",
        connecting: "Connexion...",
      },
    },
    commands: {
      title: "Commandes personnalisées",
      addCommand: "Ajouter une commande",
      commandName: "Nom de la commande :",
      commandContent: "Contenu de la commande :",
      command: "Commande",
      content: "Contenu",
      usage: "Utilisations",
      existingCommands: "Commandes existantes",
      add: "Ajouter",
      delete: "Supprimer",
      actions: "Actions",
      success: "Commande ajoutée avec succès!",
      deleted: "Commande supprimée avec succès!",
      confirmDelete: "Êtes-vous sûr de vouloir supprimer la commande !{name}?",
      addSuccess: "Commande ajoutée avec succès!",
      editPrompt: "Modifier le contenu de la commande !{name}:",
      editTitle: "Modifier la commande",
      editSuccess: "Commande mise à jour avec succès!",
      editError: "Erreur lors de la mise à jour de la commande",
      nameAndContentRequired: "Le nom et le contenu de la commande sont requis",
      deleteSuccess: "Commande supprimée avec succès!",
      deleteConfirm: "Êtes-vous sûr de vouloir supprimer la commande !{name}?",
      commandNotFound: "Commande '{name}' introuvable",
      commandExists: "Une commande avec ce nom existe déjà",
      invalidCommandName: "Nom de commande invalide",
    },
    moderation: {
      bannedWords: "Mots interdits",
      bannedWordsList: "Liste des mots interdits",
      allowedLinks: "Liens autorisés",
      allowedLinksList: "Liste des liens autorisés",
      addBannedWord: "Ajouter un mot interdit",
      addAllowedLink: "Ajouter un lien autorisé",
      word: "Mot",
      domain: "Domaine",
      action: "Action",
      duration: "Durée",
      durationSeconds: "Durée (secondes)",
      addedBy: "Ajouté par",
      addedDate: "Date d'ajout",
      allowedDomain: "Domaine autorisé :",
      bannedWord: "Mot interdit",
      actions: "Actions",
      timeout: "Timeout",
      delete: "Supprimer",
      success: "Ajouté avec succès!",
      deleted: "Supprimé avec succès!",
      confirmDelete: "Êtes-vous sûr de vouloir supprimer '{item}'?",
      bannedWordAddSuccess: "Mot interdit ajouté avec succès!",
      bannedWordDeleteSuccess: "Mot interdit supprimé avec succès!",
      bannedWordDeleteConfirm:
        'Êtes-vous sûr de vouloir supprimer le mot interdit "{word}"?',
      allowedLinkAddSuccess: "Lien autorisé ajouté avec succès!",
      allowedLinkAddError: "Erreur lors de l'ajout du lien autorisé",
      allowedLinkDeleteSuccess: "Lien autorisé supprimé avec succès!",
      allowedLinkDeleteConfirm:
        'Êtes-vous sûr de vouloir supprimer le lien autorisé "{domain}"?',
      editActionPrompt: "Entrez la nouvelle action (timeout/supprimer):",
      editDurationPrompt: "Entrez la nouvelle durée (secondes):",
      invalidDuration: "Durée invalide. Veuillez entrer un nombre positif.",
      editBannedWordTitle: "Modifier le mot interdit",
      editBannedWordSuccess: "Mot interdit mis à jour avec succès!",
      editBannedWordError: "Erreur lors de la mise à jour du mot interdit",
      wordAndDurationRequired: "Le mot et la durée sont requis",
      wordNotFound: "Mot interdit '{word}' introuvable",
      wordExists: "Ce mot interdit existe déjà",
      invalidWord: "Mot invalide",
      invalidAction: "Action invalide (timeout ou delete uniquement)",
      durationTooShort: "La durée doit être d'au moins 1 seconde",
      durationTooLong: "La durée ne peut pas dépasser 86400 secondes (24h)",
      enabled: "Activé",
      bannedWordsEnabled: "Modération des mots interdits activée",
      bannedWordsDisabled: "Modération des mots interdits désactivée",
      allowedLinksEnabled: "Modération des liens autorisés activée",
      allowedLinksDisabled: "Modération des liens autorisés désactivée",
      settingsError:
        "Erreur lors de la mise à jour des paramètres de modération",
    },
    recurring: {
      title: "Messages récurrents",
      addMessage: "Ajouter un message récurrent",
      message: "Message :",
      interval: "Intervalle (minutes) :",
      add: "Ajouter",
      activeMessages: "Messages récurrents actifs",
      status: "Statut",
      lastSent: "Dernier envoi",
      actions: "Actions",
      active: "Actif",
      inactive: "Inactif",
      edit: "Modifier",
      delete: "Supprimer",
      success: "Message récurrent ajouté avec succès!",
      updated: "Message récurrent mis à jour avec succès!",
      deleted: "Message récurrent supprimé avec succès!",
      confirmDelete: "Êtes-vous sûr de vouloir supprimer ce message récurrent?",
      addSuccess: "Message récurrent ajouté avec succès!",
      deleteSuccess: "Message récurrent supprimé avec succès!",
      updateSuccess: "Message récurrent mis à jour avec succès!",
      toggleSuccess: "Message récurrent {status} avec succès!",
      deleteConfirm: "Êtes-vous sûr de vouloir supprimer ce message récurrent?",
      editMessage: "Nouveau message:",
      editInterval: "Nouvel intervalle (minutes):",
      enabled: "activé",
      disabled: "désactivé",
      never: "Jamais",
      messageRequired: "Le message est requis",
      intervalRequired: "L'intervalle est requis",
      intervalTooShort: "L'intervalle doit être d'au moins 1 minute",
      intervalTooLong: "L'intervalle ne peut pas dépasser 1440 minutes (24h)",
      messageNotFound: "Message récurrent introuvable",
      messageExists: "Ce message récurrent existe déjà",
      // Messages d'erreur du gestionnaire
      errorLoadingMessages: "Erreur lors du chargement des messages récurrents",
      errorAddingMessage: "Erreur lors de l'ajout du message récurrent",
      errorUpdatingMessage:
        "Erreur lors de la mise à jour du message récurrent",
      errorDeletingMessage:
        "Erreur lors de la suppression du message récurrent",
      messageAdded: "Message récurrent ajouté avec succès",
      messageUpdated: "Message récurrent mis à jour avec succès",
      messageDeleted: "Message récurrent supprimé avec succès",
    },
    integrations: {
      spotify: "Spotify",
      obs: "OBS",
      apex: "Apex Legends",
      status: "Statut :",
      api: "API :",
      player: "Joueur :",
      refresh: "Actualiser",
      currentSong: "Chanson actuelle :",
      noSong: "Aucune chanson en cours",
      configured: "Configuré dans .env",
      spotifyAuth: {
        title: "Autorisation Spotify",
        step1:
          "Obtenez l'URL d'autorisation et ouvrez-la dans votre navigateur",
        step2:
          "Après autorisation, copiez le code d'autorisation depuis l'URL de redirection",
        step3:
          "Collez le code d'autorisation ci-dessous pour obtenir votre refresh token",
        autoStep1:
          "Cliquez sur le bouton ci-dessous pour obtenir l'URL d'autorisation",
        autoStep2:
          "Après autorisation, votre refresh token sera automatiquement ajouté à votre fichier .env",
        autoNote:
          "Le processus est maintenant entièrement automatisé - aucune copie manuelle requise !",
        getAuthUrl: "Obtenir l'URL d'autorisation",
        openInBrowser: "Ouvrir dans le navigateur",
        getRefreshToken: "Obtenir le Refresh Token",
        copyToken: "Copier",
        authCodePlaceholder: "Collez le code d'autorisation ici...",
        refreshTokenLabel: "Refresh Token :",
        redirectUrlNote: "L'URL de redirection ressemblera à :",
        redirectUrlExample:
          "https://127.0.0.1:3000/callback/spotify?code=XXXXX",
        authUrlGenerated: "URL d'autorisation générée avec succès !",
        authPageOpened: "Page d'autorisation ouverte dans un nouvel onglet",
        tokenGenerated:
          "Autorisation réussie ! Copiez le refresh token dans votre fichier .env.",
        tokenCopied: "Refresh token copié dans le presse-papiers !",
        errors: {
          generateUrl: "Erreur lors de la génération de l'URL d'autorisation",
          exchangeCode: "Erreur lors de l'échange du code d'autorisation",
          noAuthCode: "Veuillez entrer le code d'autorisation",
          noTokenToCopy: "Aucun refresh token à copier",
          generateUrlFirst: "Veuillez d'abord générer l'URL d'autorisation",
        },
      },
    },
    common: {
      add: "Ajouter",
      edit: "Modifier",
      delete: "Supprimer",
      save: "Enregistrer",
      cancel: "Annuler",
      refresh: "Actualiser",
      actions: "Actions",
      confirmDelete: "Confirmer la suppression",
    },
    status: {
      connected: "Connecté",
      disconnected: "Déconnecté",
    },
    spotify: {
      noSong: "Aucune chanson en cours",
      // Messages de configuration et de connexion
      tokenNotConfigured:
        "⚠️ Token Spotify non configuré. Les commandes Spotify ne fonctionneront pas.",
      notConnected:
        "Spotify non connecté. Configurez votre token dans le fichier .env",
      // Messages de statut de musique
      noMusicPlaying: "Pas de musique en ce moment ! Le DJ fait une pause 😴",
      currentSong: "🎵 {song} - {artists} | Album: {album}",
      // Messages de demande de chanson
      invalidUrl: "URL Spotify invalide. Utilisez un lien de chanson Spotify.",
      songAddedToQueue:
        '✅ "{song}" par {artists} ajouté à la file par {username}!',
      unableToAddToQueue:
        '❌ Impossible d\'ajouter "{song}" par {artists} à la file. Spotify ne joue pas.',
      // Messages d'erreur
      errorInitialization: "❌ Erreur lors de l'initialisation de Spotify",
      errorRefreshingToken: "Erreur lors du rafraîchissement du token Spotify",
      errorRetrievingSong:
        "Erreur lors de la récupération de la chanson actuelle",
      errorRetrievingSongMessage:
        "Erreur lors de la récupération de la chanson actuelle",
      errorRequestingSong: "Erreur lors de la demande de chanson",
      errorRequestingSongMessage:
        "Erreur lors de la demande de chanson. Vérifiez que l'URL est valide.",
      errorAddingToQueue: "Erreur lors de l'ajout à la file",
      errorSearchingTrack: "Erreur lors de la recherche de piste",
      errorExchangingAuthCode:
        "Erreur lors de l'échange du code d'autorisation",
    },
    apex: {
      available: "Disponible",
      unavailable: "Indisponible",
      configured: "Configuré dans .env",
      // Messages d'API et de configuration
      apiKeyRequired:
        "Clé API Mozambique requise. Configurez APEX_API_KEY dans votre fichier .env",
      playerNotFound:
        "Joueur non trouvé. Vérifiez le nom d'utilisateur et la plateforme.",
      invalidApiKey: "Clé API Mozambique invalide. Vérifiez votre clé API.",
      usernameNotConfigured:
        "Nom d'utilisateur Apex non configuré dans le fichier .env",
      // Messages de données
      noRankData: "Aucune donnée de rang disponible",
      noLegendData: "Aucune donnée de légende disponible",
      noSeasonData: "Aucune donnée de saison disponible",
      legendNotFound: "Légende '{legend}' non trouvée",
      // Messages de statistiques
      rank: "Rang: {rank}",
      legendStats:
        "{legend}: Kills: {kills} | K/D: {kd} | Dégâts: {damage} | Victoires: {wins} ({winRate}%)",
      seasonStats:
        "Saison actuelle | Niveau: {level} | Kills: {kills} | K/D: {kd} | Dégâts: {damage} | Victoires: {wins} ({winRate}%)",
      // Messages d'erreur
      errorGettingRank: "Erreur lors de la récupération du rang Apex",
      errorGettingLegendStats:
        "Erreur lors de la récupération des stats de légende",
      errorGettingLegendStatsMessage:
        "Erreur lors de la récupération des statistiques de légende.",
      errorGettingSeasonStats:
        "Erreur lors de la récupération des stats de saison",
      // Messages de statut d'API
      apiAvailable: "API Mozambique disponible",
      apiUnavailable: "API indisponible: {status} - {statusText}",
      apiConnectionError:
        "Impossible de contacter l'API Mozambique ou clé API invalide",
    },
    obs: {
      available: "Disponible",
      unavailable: "Indisponible",
      configured: "Configuré dans .env",
      // Messages de statut d'intégration
      integrationDisabled:
        "Intégration OBS désactivée - variables d'environnement manquantes",
      notConnected: "OBS non connecté",
      // Messages de contrôle de stream
      streamStarted: "Stream démarré avec succès",
      streamStopped: "Stream arrêté avec succès",
      // Messages de contrôle de scène
      sceneChanged: "Scène changée vers '{scene}'",
      // Messages de contrôle de source
      sourceNotFound: "Source '{source}' non trouvée dans la scène '{scene}'",
      sourceToggled: "Source '{source}' {status}",
      // Messages d'erreur
      errorLoadingMediaSources: "Erreur lors du chargement des sources média",
      errorRetrievingScenes: "Erreur lors de la récupération des scènes",
      errorRetrievingSources: "Erreur lors de la récupération des sources",
      errorRetrievingStreamStatus:
        "Erreur lors de la récupération du statut de stream",
      errorStartingStream: "Erreur lors du démarrage du stream",
      errorStartingStreamMessage: "Erreur lors du démarrage du stream",
      errorStoppingStream: "Erreur lors de l'arrêt du stream",
      errorStoppingStreamMessage: "Erreur lors de l'arrêt du stream",
      errorChangingScene: "Erreur lors du changement de scène",
      errorChangingSceneMessage: "Erreur lors du changement de scène",
      errorTogglingSource: "Erreur lors du toggle de la source",
      errorTogglingSourceMessage: "Erreur lors du toggle de la source",
    },
    bot: {
      messageSent: "Message envoyé!",
    },
    errors: {
      serverCommunication: "Erreur lors de la communication avec le serveur",
      databaseError: "Erreur de base de données",
      validationError: "Erreur de validation",
      authenticationError: "Erreur d'authentification",
      permissionError: "Permission refusée",
      notFound: "Ressource introuvable",
      internalError: "Erreur interne du serveur",
      networkError: "Erreur de réseau",
      timeoutError: "Délai d'attente dépassé",
    },
    database: {
      errorOpening: "Erreur lors de l'ouverture de la base de données",
      insertingDefaultLinks: "📝 Insertion des liens autorisés par défaut...",
      errorInsertingDefaultData:
        "Erreur lors de l'insertion des données par défaut",
    },
    notifications: {
      error: "Erreur lors de la communication avec le serveur",
      success: "Opération terminée avec succès",
      info: "Information",
      warning: "Avertissement",
      loading: "Chargement...",
      saving: "Enregistrement...",
      deleting: "Suppression...",
      updating: "Mise à jour...",
      refreshing: "Actualisation...",
    },
    callback: {
      twitch: {
        errorTitle: "Erreur d'authentification Twitch",
        successTitle: "Authentification Twitch Réussie",
        accessDeniedTitle: "Accès refusé",
        authErrorTitle: "Erreur d'authentification",
        errorMessage: "Erreur: {error}",
        missingCode: "Code d'autorisation manquant",
        noCodeReceived: "Aucun code d'autorisation n'a été reçu.",
        welcomeMessage: "Bienvenue, {username} !",
        accessGranted: "Vous avez accès à l'interface d'administration.",
        accessDenied:
          "Désolé, vous devez être modérateur ou broadcaster pour accéder à cette interface.",
        returnToInterface: "Retour à l'interface",
        accessInterface: "Accéder à l'interface",
      },
      spotify: {
        errorTitle: "Erreur Spotify",
        successTitle: "Autorisation Spotify Réussie",
        authErrorTitle: "Erreur d'autorisation Spotify",
        errorMessage: "Erreur: {error}",
        missingCode: "Code d'autorisation manquant",
        noCodeReceived: "Aucun code d'autorisation n'a été reçu.",
        successMessage: "Votre code d'autorisation a été récupéré avec succès.",
        authorizationCode: "Code d'autorisation :",
        copyCode:
          "Copiez ce code et collez-le dans votre terminal où le script de setup est en attente.",
        setupInstructions:
          "Si le script de setup n'est plus en cours, relancez-le avec : npm run setup",
        returnToInterface: "Retour à l'interface",
        // Nouveaux messages de callback automatique
        autoSuccessMessage:
          "Votre refresh token Spotify a été automatiquement ajouté à votre fichier .env !",
        refreshTokenAdded: "Refresh token ajouté au .env :",
        refreshTokenLabel: "Refresh Token :",
        copyToken: "Copier le Token",
        tokenCopied: "Copié !",
        restartRequired:
          "Veuillez redémarrer le bot pour que les changements prennent effet.",
        exchangeError: "Erreur d'échange de token",
        exchangeErrorMessage:
          "Échec de l'échange du code d'autorisation contre un refresh token. Veuillez réessayer.",
        externalEnvWarning: "Gestion d'environnement externe",
        externalEnvMessage:
          "Si votre fichier .env est géré à l'extérieur (ex: Coolify, Docker, ou serveur distant avec variables d'environnement), vous devez manuellement ajouter ce refresh token à votre configuration d'environnement.",
      },
    },
    ads: {
      status: "Statut des Publicités",
      controls: "Contrôles des Publicités",
      history: "Historique des Publicités",
      commercialLength: "Durée de la publicité (secondes)",
      startCommercial: "Démarrer une Publicité",
      snoozeNextAd: "Reporter la Prochaine Publicité",
      refreshStatus: "Actualiser le Statut",
      commercialActive: "Publicité Active",
      noActiveCommercial: "Aucune Publicité Active",
      nextAdIn: "Prochaine publicité dans {minutes} minutes",
      noScheduledAds: "Aucune Publicité Programmée",
      nextBreakIn: "Prochaine pause dans {minutes} minutes",
      noScheduledBreaks: "Aucune Pause Programmée",
      commercialStarted:
        "Publicité démarrée avec succès pour {seconds} secondes",
      commercialFailed: "Échec du démarrage de la publicité",
      adSnoozed: "La prochaine publicité a été reportée avec succès",
      adSnoozeFailed: "Échec du report de la prochaine publicité",
      noRecentActivity: "Aucune activité récente",
    },
  },

  // Setup
  setup: {
    title: "Configuration du Bot Twitch",
    welcome: "Bienvenue dans la configuration du Bot Twitch!",
    language: "Langue",
    selectLanguage: "Sélectionnez votre langue préférée:",
    twitch: {
      title: "Configuration Twitch",
      description: "Configurez vos identifiants Twitch",
      username: "Nom d'utilisateur Twitch",
      oauth: "Token OAuth",
      channel: "Nom du canal",
      instructions:
        "1. Allez sur https://twitchapps.com/tmi/\n2. Générez votre token OAuth\n3. Copiez le token (commence par oauth:)",
    },
    spotify: {
      title: "Configuration Spotify",
      description: "Configurez l'intégration Spotify (optionnel)",
      clientId: "Client ID",
      clientSecret: "Client Secret",
      redirectUri: "URI de redirection",
      instructions:
        "1. Allez sur https://developer.spotify.com/dashboard\n2. Créez une nouvelle application\n3. Ajoutez /callback/spotify dans les Redirect URIs (localhost:3000)",
    },
    apex: {
      title: "Configuration Apex Legends",
      description: "Configurez l'API Apex Legends (optionnel)",
      apiKey: "Clé API",
      playerName: "Nom du joueur",
      platform: "Plateforme",
      instructions:
        "1. Allez sur https://apexlegendsapi.com/\n2. Obtenez votre clé API\n3. Entrez votre nom de joueur et plateforme",
    },
    obs: {
      title: "Configuration OBS",
      description: "Configurez la connexion OBS WebSocket (optionnel)",
      host: "Hôte",
      port: "Port",
      password: "Mot de passe",
      instructions:
        "1. Activez le WebSocket dans OBS (Outils > WebSocket Server Settings)\n2. Configurez le mot de passe si nécessaire",
    },
    web: {
      title: "Configuration Interface Web",
      description: "Configurez l'interface de gestion web",
      port: "Port",
      authEnabled: "Activer l'authentification",
      instructions:
        "Configurez le port de l'interface web et l'authentification",
    },
    complete: "Configuration terminée avec succès!",
    startBot: "Vous pouvez maintenant démarrer le bot avec: npm start",
  },
};
