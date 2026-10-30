// Imports des packages
const express = require("express");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
// Ici je charge les variables d'environnement de mon fichier .env
require("dotenv").config();

// Création du serveur
const app = express();

// une fois cloudinary installé, puis importé, on va mettre en place notre config d'authentification :
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Utilisation des données JSON dans le body
app.use(express.json());

// Connexion à la base de données Vinted :
mongoose.connect(process.env.MONGODB_URI);

// Route de bienvenue :
app.get("/", (req, res) => {
  try {
    return res.status(200).json("Bienvenue sur le serveur de Vinted !");
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// J'importe les routes des utilisateurs
const userRoutes = require("./routes/user");
app.use(userRoutes);

// J'importe les routes des offres
const offerRoutes = require("./routes/offers");
app.use(offerRoutes);

// Route pour les adresses inconnues
app.all(/.*/, (req, res) => {
  return res.status(404).json({ message: "Not found" });
});

// Démarrage du serveur
app.listen(3000, () => {
  console.log("Vinted server started 💲");
});
