const mongoose = require("mongoose");

const productReceiptSchema = new mongoose.Schema({
  supplier_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supplier",
    required: true,
  },
  receipt_date: {
    type: Date,
    default: Date.now,
    required: true,
  },
  products: [
    {
      product_name: { type: String, required: true },
      model: { type: String, required: true },
      quantity: { type: Number, required: true },
      unit_price: { type: Number, required: true },
      currency: {
        type: String,
        enum: ["usd", "sum"],
        required: true,
        default: "sum",
      },
      total_price: { type: Number, required: true },
      brand_name: { type: String },
      count_type: { type: String, required: true },
      barcode: { type: String },
      kimdan_kelgan: { type: String },
    },
  ],
  total_amount: { type: Number, required: true },
  paid_amount: { type: Number, default: 0 },
  debt_amount: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ["paid", "partial", "debt"],
    default: "debt",
  },
  payment_method: {
    type: String,
    enum: ["cash", "card", "transfer"],
    default: "cash",
  },
  notes: { type: String },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// Har bir mahsulotning umumiy narxini hisoblash
productReceiptSchema.pre("save", function (next) {
  this.products.forEach((product) => {
    product.total_price = product.quantity * product.unit_price;
  });

  this.total_amount = this.products.reduce(
    (total, product) => total + product.total_price,
    0
  );
  this.debt_amount = this.total_amount - this.paid_amount;

  // Statusni aniqlash
  if (this.paid_amount === 0) {
    this.status = "debt";
  } else if (this.paid_amount < this.total_amount) {
    this.status = "partial";
  } else {
    this.status = "paid";
  }

  next();
});

module.exports = mongoose.model("ProductReceipt", productReceiptSchema);
