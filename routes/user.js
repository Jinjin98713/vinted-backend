const express = require("express");
const router = express.Router();
const User = require("../models/User");

const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");

const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;

const convertToBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.data.toString("base64")}`;
};

// Route d'inscription :
router.post("/user/signup", fileUpload(), async (req, res) => {
  try {
    //console.log(req.body);
    // réponse :
    /*     {
  username: 'JohnDoe',
  email: 'johndoe@lereacteur.io',
  password: 'azerty',
  newsletter: true
} */
    // on va vérifier si l'email est déjà utilisé
    const existingEmail = await User.findOne({ email: req.body.email });

    // je vérifie si l'email existe alors je renvoie une erreur
    if (existingEmail) {
      return res.status(409).json({ message: "L'email est déjà utilisé" });
    }

    // je vérifie si le nom est bien renseigné, sinon je renvoie une erreur
    if (!req.body.username) {
      return res
        .status(400)
        .json({ message: "Le nom de l'utilisateur doit être renseigné" });
    }

    // je vérifie si le mot de passe est bien renseigné, sinon je renvoie une erreur
    if (!req.body.password) {
      return res
        .status(400)
        .json({ message: "Le mot de passe doit être renseigné" });
    }

    // Je génère un salt et un token pour le nouvel utilisateur
    const salt = uid2(18);
    const token = uid2(24);
    // Je concatène le mot de passe avec le salt
    const saltedPassword = req.body.password + salt;
    // Je génère le hash du mot de passe avec SHA256
    const cryptedSaltedPassword = SHA256(saltedPassword);
    const hash = encBase64.stringify(cryptedSaltedPassword);

    // ici je vais enregistrer un nouvel utilisateur
    const newUser = new User({
      email: req.body.email,
      account: {
        username: req.body.username,
      },
      newsletter: req.body.newsletter,
      token: token,
      hash: hash,
      salt: salt,
    });

    // ici je sauvegarde le nouvel utilisateur dans ma BDD
    await newUser.save();

    // je vérifie si un avatar a été envoyé dans la requête
    if (req.files && req.files.avatar) {
      // ici je convertis mon avatar en Base64
      const base64Picture = convertToBase64(req.files.avatar);

      // ici j'envoie mon avatar sur Cloudinary
      const uploadResult = await cloudinary.uploader.upload(base64Picture);

      // ici j'associe les informations de l'avatar à mon utilisateur
      newUser.account.avatar = uploadResult;

      // ici j'enregistre à nouveau mon utilisateur avec son avatar
      await newUser.save();
    }

    // je prépare l'objet que je vais renvoyer au client
    const responseObject = {
      _id: newUser._id,
      token: newUser.token,
      account: {
        username: newUser.account.username,
        avatar: newUser.account.avatar,
      },
    };
    return res.status(200).json(responseObject);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// route log_in
router.post("/user/login", async (req, res) => {
  try {
    //console.log(req.body); //{ email: 'johndoe@lereacteur.io', password: 'azerty' }

    // on va vérifier si l'utilisateur existe
    const existingAccount = await User.findOne({ email: req.body.email });
    // Si aucun utilisateur n'existe avec cet email, je renvoie une erreur
    if (!existingAccount) {
      return res
        .status(400)
        .json({ message: "Aucun utilisateur ne correspond à cet email" });
    }

    // Je concatène le mot de passe avec le salt enregistré dans la BDD
    const saltedPassword = req.body.password + existingAccount.salt;

    // Je génère un nouveau hash avec le mot de passe et le salt
    const newHash = encBase64.stringify(SHA256(saltedPassword));

    // Je compare le nouveau hash avec celui enregistré dans la BDD
    if (newHash !== existingAccount.hash) {
      return res.status(401).json({ message: "Non autorisé" });
    } else {
      // si le mot de passe est correct, je renvoie les informations de l'utilisateur
      return res.status(200).json({
        _id: existingAccount._id,
        token: existingAccount.token,
        account: {
          username: existingAccount.account.username,
        },
      });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
