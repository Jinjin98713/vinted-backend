const User = require("../models/User");

// ici je vais vérifier si un utilisateur correspond au token envoyé dans la requête
const isAuthenticated = async (req, res, next) => {
  // je vérifie que la requête contient bien un header Authorization
  if (!req.headers.authorization) {
    return res.status(401).json("Unauthorized");
  }

  // ici je récupère le token en supprimant le "Bearer " qui le précède
  const token = req.headers.authorization.replace("Bearer ", "");
  //console.log(token);

  // ici je recherche dans MongoDB l'utilisateur qui possède ce token
  // avec .select("account"), je récupère uniquement les informations du compte et son _id
  const authorizedUser = await User.findOne({ token: token }).select("account");

  // je vérifie si un utilisateur a bien été trouvé
  if (authorizedUser) {
    // ici je stocke l'utilisateur dans req.user pour pouvoir le récupérer dans mes routes
    req.user = authorizedUser;

    // ici je passe à la suite de la requête
    return next();
  } else {
    // si aucun utilisateur ne correspond au token, je renvoie une erreur
    return res.status(401).json("Unauthorized");
  }
};

module.exports = isAuthenticated;
