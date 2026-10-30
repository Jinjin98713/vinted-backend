const express = require("express");
const router = express.Router();
const Offer = require("../models/Offers");
const isAuthenticated = require("../middleware/isAuthenticated");
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;
const mongoose = require("mongoose");

const convertToBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.data.toString("base64")}`;
};

// route create offers :
router.post(
  "/offer/publish",
  isAuthenticated,
  fileUpload(),
  async (req, res) => {
    try {
      //console.log(req.headers.authorization); //ok

      // ici je récupère les informations de l'annonce envoyées dans le body
      const offer = req.body;

      // je vérifie qu'une image a bien été envoyée
      if (!req.files || !req.files.picture) {
        return res.status(400).json({
          message: "Une image doit être renseignée",
        });
      }

      // je vérifie que le titre ne dépasse pas 50 caractères
      if (!offer.title || offer.title.length > 50) {
        return res.status(400).json({
          message: "Le titre ne doit pas dépasser 50 caractères",
        });
      }

      // je vérifie que la description ne dépasse pas 500 caractères
      if (!offer.description || offer.description.length > 500) {
        return res.status(400).json({
          message: "La description ne doit pas dépasser 500 caractères",
        });
      }

      // je vérifie que le prix est renseigné, qu'il s'agit d'un nombre
      // et qu'il est compris entre 0 et 100000
      if (
        !offer.price ||
        isNaN(Number(offer.price)) ||
        Number(offer.price) < 0 ||
        Number(offer.price) > 100000
      ) {
        return res.status(400).json({
          message: "Le prix doit être compris entre 0 et 100000",
        });
      }

      // ici je vais faire correspondre les clefs de la réponse à ceux du body
      const productDetailsMap = {
        MARQUE: "brand",
        TAILLE: "size",
        ÉTAT: "condition",
        COULEUR: "color",
        EMPLACEMENT: "city",
      };

      // je récupère toutes les clés de productDetailsMap et je les stocke dans un tableau
      const productDetails = Object.keys(productDetailsMap);
      //console.log(productDetail);

      // ensuite je retranforme le tout en tableau contenant les clés et les valeurs que j'utilise dans ma nouvelle offre
      const tabProductDetails = productDetails.map((key) => {
        const keys = productDetailsMap[key];
        return { [key]: offer[keys] };
      });
      //console.log(tabProductDetails);

      // on va créer une nouvelle offre
      const newOffer = new Offer({
        product_name: offer.title,
        product_description: offer.description,
        product_price: offer.price,
        product_details: tabProductDetails,
        owner: req.user,
      });

      // ici j'enregistre ma nouvelle offre dans MongoDB
      await newOffer.save();

      // ici je vais uploader mon image
      const base64Picture = convertToBase64(req.files.picture);
      const uploadResult = await cloudinary.uploader.upload(base64Picture, {
        asset_folder: `vinted/offers/${newOffer._id}`,
      });
      // je vérifie le chemin du dossier :
      //console.log(uploadResult);

      // je vérifie que mon image est bien enregistrée sur Cloudinary
      //console.log(uploadResult.secure_url);

      // ici j'associe les informations de mon image à mon offre
      newOffer.product_image = uploadResult;

      // j'enregistre à nouveau mon offre avec son image
      await newOffer.save();

      return res.status(200).json(newOffer);
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  },
);

// route update offers :

// route delete offers :

// route read offers par filtres :
router.get("/offers", async (req, res) => {
  try {
    // ici je récupère les paramètres de recherche dans req.query
    const { title, priceMin, priceMax, sort, page } = req.query;

    // ici je vérifie si le numéro de page est valide
    if (
      page !== undefined &&
      (!Number.isInteger(Number(page)) || Number(page) < 1)
    ) {
      return res.status(400).json({
        message: "Le numéro de page doit être un entier supérieur ou égal à 1",
      });
    }

    // ici je vérifie si le prix minimum est valide
    if (
      priceMin !== undefined &&
      (priceMin === "" ||
        !Number.isFinite(Number(priceMin)) ||
        Number(priceMin) < 0)
    ) {
      return res.status(400).json({
        message: "Le prix minimum doit être un nombre positif ou nul",
      });
    }

    // ici je vérifie si le prix maximum est valide
    if (
      priceMax !== undefined &&
      (priceMax === "" ||
        !Number.isFinite(Number(priceMax)) ||
        Number(priceMax) < 0)
    ) {
      return res.status(400).json({
        message: "Le prix maximum doit être un nombre positif ou nul",
      });
    }

    // ici je vérifie si le tri demandé est valide
    if (sort && sort !== "price-asc" && sort !== "price-desc") {
      return res.status(400).json({
        message: "Le tri doit être price-asc ou price-desc",
      });
    }

    // ici je crée un objet vide pour stocker mes filtres
    const filters = {};

    // ici je vérifie si un titre a été renseigné
    if (title) {
      // ici je recherche les annonces contenant le titre, sans tenir compte de la casse
      filters.product_name = new RegExp(title, "i");
    }

    // ici je vérifie si un prix minimum ou maximum a été renseigné
    if (priceMin !== undefined || priceMax !== undefined) {
      //ici je crée un objet vide pour stocker mes conditions de prix
      filters.product_price = {};

      // ici je définis le prix minimum
      if (priceMin !== undefined) filters.product_price.$gte = Number(priceMin);

      // ici je définis le prix maximum
      if (priceMax !== undefined) filters.product_price.$lte = Number(priceMax);
    }
    //console.log(filters);
    // j'ai vérifié les requêtes suivantes :
    // /offers -> retourne le nombre total d'annonces et les annonces de la première page
    // /offers?title=nike -> { product_name: /nike/i }
    // /offers?priceMin=40 -> { product_price: { '$gte': 40 } }
    // /offers?priceMax=200 -> { product_price: { '$lte': 200 } }
    // /offers?priceMin=40&priceMax=200 -> { product_price: { '$gte': 40, '$lte': 200 } }
    // /offers?title=nike&priceMin=40&priceMax=200 -> { product_name: /nike/i, product_price: { '$gte': 40, '$lte': 200 } }

    // ici je vais gérer un tri dynamique avec sort
    const sorting = {};
    // ici je vérifie si un paramètre de tri a été renseigné
    if (sort) {
      // ici je trie les annonces par prix décroissant
      if (sort === "price-desc") sorting.product_price = -1;

      // ici je trie les annonces par prix croissant
      if (sort === "price-asc") sorting.product_price = 1;
    }
    //console.log(sorting);
    // j'ai vérifié les requêtes suivantes :
    // /offers?sort=price-desc -> { product_price: -1 }
    // /offers?sort=price-asc ->  { product_price: 1 }

    // ici je définis la première page par défaut
    let currentPage = 1;

    // ici je définis le nombre maximum d'annonces par page
    const limitOffers = 2;

    // ici je vérifie si une page a été renseignée
    if (page) {
      currentPage = Number(page);
    }

    // ici je calcule combien d'annonces je dois ignorer selon la page
    const skip = (currentPage - 1) * limitOffers;
    // ici je recherche les annonces avec les filtres, le tri et la pagination
    const offers = await Offer.find(filters)
      .populate("owner", "account")
      .sort(sorting)
      .limit(limitOffers)
      .skip(skip);

    //console.log(offers);
    // /offers?sort=price-asc -> un tableau contenant les annonces triées par prix croissant
    // /offers?sort=price-desc -> un tableau contenant les annonces triées par prix décroissant

    // ici je compte le nombre total d'annonces correspondant à mes filtres
    const totalOffer = await Offer.countDocuments(filters);
    //console.log(totalOffer);

    return res.status(200).json({
      count: totalOffer,
      offers: offers,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// route read offers par id :
router.get("/offers/:id", async (req, res) => {
  try {
    // ici je vérifie si l'identifiant est valide
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Identifiant invalide",
      });
    }

    // ici je recherche l'annonce correspondant à l'id reçu dans l'URL
    const offerById = await Offer.findById(req.params.id).populate(
      "owner",
      "account",
    );

    // ici je vérifie si l'annonce existe
    if (!offerById) {
      return res.status(404).json({
        message: "Annonce introuvable",
      });
    }

    return res.status(200).json(offerById);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
