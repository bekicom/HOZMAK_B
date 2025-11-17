const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const bodyParser = require("body-parser");
const cors = require("cors");
const mainRoutes = require("./routes/mainRoutes");
const dbConfig = require("./config/dbConfig");
require("dotenv").config();

const app = express();

dbConfig.connectDB();

const corsOptions = {
  origin: [
    "http://localhost:3000", // Backend lokal
  ],
  methods: ["GET", "POST", "PUT", "DELETE"], // Ruxsat etilgan HTTP metodlar
  credentials: true,
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

app.use(bodyParser.json());
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.use("/api", mainRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
