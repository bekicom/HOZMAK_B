const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    product_name: { type: String, required: true },
    model: { type: String, required: true },

    stock: { type: Number,  min: 1 },

    // ⭐ Olish narxi (tannarx)
    purchase_price: { type: Number, required: true, min: 0 },

    purchase_currency: {
      type: String,
      enum: ["usd", "sum"],
      default: "usd",
    },

    // ⭐ Sotish narxi (1 dona narxi)
    sell_price: { type: Number, required: true, min: 0 },

    sell_currency: {
      type: String,
      enum: ["usd", "sum"],
      default: "usd",
    },

    brand_name: { type: String },

    storeProduct: { type: Boolean, default: false },

    count_type: {
      type: String,
      enum: ["dona", "metr", "kg", "litr", "qadoq", "blok"],
      required: true,
    },

    barcode: { type: String, required: true, unique: true, trim: true },

    special_notes: { type: String, default: "" },
    kimdan_kelgan: { type: String, default: "" },

    /**
     * ⭐ To‘lov / qarz ma’lumotlari
     * Frontend createProduct paytida:
     * paid_amount = client hozir bergan summa
     * Qolgani qarz → (sell_price * stock - paid_amount)
     */
    paid_amount: { type: Number, default: 0, min: 0 },

    // Auto-calculated fields
    total_purchase_price: { type: Number, default: 0, min: 0 },
    total_sell_price: { type: Number, default: 0, min: 0 },
    debt_amount: { type: Number, default: 0, min: 0 },

    client_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },
  },
  {
    versionKey: false,
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

/**
 * ⭐total_sell_price, total_purchase_price, debt_amount larni avtomatik hisoblaymiz
 */
productSchema.pre("validate", function (next) {
  const stock = Number(this.stock || 0);
  const sell = Number(this.sell_price || 0);
  const buy = Number(this.purchase_price || 0);
  const paid = Number(this.paid_amount || 0);

  // umumiy tannarx
  this.total_purchase_price = stock * buy;

  // umumiy sotuv narxi
  this.total_sell_price = stock * sell;

  // qarz = total_sell_price - paid_amount
  const debt = this.total_sell_price - paid;
  this.debt_amount = debt > 0 ? debt : 0;

  next();
});

/**
 * updated_at ni avtomatik yangilash
 */
productSchema.pre("findOneAndUpdate", function (next) {
  this.set({ updated_at: new Date() });
  next();
});

module.exports = mongoose.model("Product", productSchema);
