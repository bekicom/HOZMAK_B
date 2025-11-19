const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["supplier", "customer"],
      default: "supplier",
    },

    name: { type: String, required: true },
    phone: { type: String },
    address: { type: String },

    // === CUSTOMERS (sizga qarzdor bo‘lganlar) ===
    debt_total: { type: Number, default: 0 },

    debt_history: [
      {
        amount: Number,
        paid: { type: Boolean, default: false },
        created_at: { type: Date, default: Date.now },
        due_date: { type: Date },
      },
    ],

    // === PURCHASE HISTORY (customers) ===
    purchase_history: [
      {
        sale_id: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
        products: [
          {
            product_id: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Product",
            },
            quantity: Number,
            price: Number,
            total: Number,
          },
        ],
        payment_type: { type: String, enum: ["cash", "card", "credit"] },
        created_at: { type: Date, default: Date.now },
      },
    ],

    // === SUPPLIER (kimdan tovar olasiz) ===
    supplier_total_debt: { type: Number, default: 0 },

    supplier_debt_history: [
      {
        total_price: Number, // stock × purchase_price
        paid_amount: Number, // admin bergan pul
        remaining_debt: Number, // umumiy - to'langan
        product_name: String,
        quantity: Number,
        price_per_item: Number,
        created_at: { type: Date, default: Date.now },
      },
    ],

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

clientSchema.pre("findOneAndUpdate", function (next) {
  this.set({ updated_at: new Date() });
  next();
});

module.exports = mongoose.model("Client", clientSchema);
