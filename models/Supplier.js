const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Yetkazib beruvchi nomi kiritilishi shart"],
      trim: true,
    },
    company_name: {
      type: String,
      required: [true, "Firma nomi kiritilishi shart"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Telefon raqami kiritilishi shart"],
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Manzil kiritilishi shart"],
      trim: true,
    },
    contact_person: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Telefon raqami unikal bo'lishi
supplierSchema.index({ phone: 1 }, { unique: true });

module.exports = mongoose.model("Supplier", supplierSchema);
