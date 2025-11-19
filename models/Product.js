const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    product_name: { type: String, required: true },
    model: { type: String, required: true },

    stock: { type: Number, required: true },

    purchase_price: { type: Number, required: true },

    currency: {
      type: String,
      enum: ["usd", "sum"],
      required: true,
      default: "sum",
    },

    sell_price: { type: Number, required: true },

    brand_name: { type: String },

    storeProduct: { type: Boolean, default: false },

    count_type: { type: String, required: false },

    barcode: { type: String, required: true, unique: true },

    special_notes: { type: String },

    // Mahsulot qaysi clientdan kelgan
    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
    },

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

productSchema.pre("findOneAndUpdate", function (next) {
  this.set({ updated_at: new Date() });
  next();
});

module.exports = mongoose.model("Product", productSchema);
