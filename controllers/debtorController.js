const Debtor = require("../models/Debtor");
const Sale = require("../models/Sale");
const Store = require("../models/Store");
const Product = require("../models/Product");

exports.createDebtor = async (req, res) => {
  try {
    const { name, phone, due_date, currency, debt_amount, products } = req.body;

    // 🔒 1. Validatsiya
    if (
      !name ||
      !phone ||
      !due_date ||
      !currency ||
      !debt_amount ||
      !products?.length
    ) {
      return res.status(400).json({ message: "Kerakli maydonlar to'liq emas" });
    }

    // 🔁 2. Har bir mahsulot uchun mavjudlikni tekshirish va sonni kamaytirish
    for (const item of products) {
      const storeItem = await Store.findOne({ product_id: item.product_id });

      if (!storeItem) {
        return res
          .status(404)
          .json({ message: `${item.product_name} dokonda topilmadi` });
      }

      if (storeItem.quantity < item.quantity) {
        return res.status(400).json({
          message: `${item.product_name} mahsulotidan dokonda yetarli miqdor yo‘q! Mavjud: ${storeItem.quantity}, So‘ralgan: ${item.quantity}`,
        });
      }

      // ➖ Mahsulot miqdorini kamaytirish
      // storeItem.quantity -= item.quantity;
      // await storeItem.save(); 
    }

    // 📝 3. Qarzdorlikni saqlash
    const newDebtor = new Debtor({
      name,
      phone,
      due_date,
      currency,
      debt_amount,
      products,
    });

    await newDebtor.save();

    return res.status(201).json({
      message: "Qarzdorlik muvaffaqiyatli yaratildi",
      debtor: newDebtor,
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ message: "Serverda xatolik" });
  }
};


exports.editDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    await Debtor.findByIdAndUpdate(id, req.body);
    res.status(200).json({ message: "Qarzdor ma'lumotlari yangilandi" });
  } catch (err) {
    console.log(err.message);
    return res.status(500).json({ message: "Serverda xatolik" });
  }
};
exports.updateDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, product_id } = req.body;

    const parsedAmount = amount;
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "To'langan summa noto'g'ri" });
    }

    const debtor = await Debtor.findById(id);
    if (!debtor) return res.status(404).json({ message: "Qarzdor topilmadi" });

    debtor.debt_amount -= parsedAmount;
    debtor.payment_log.push({ amount: parsedAmount, date: new Date() });

    // Qarzdor to‘liq to‘ladi, mahsulotlar sotuvga o‘tadi
    if (debtor.debt_amount <= 0) {
      for (const p of debtor.products) {
        const product = await Product.findById(p.product_id);
        await Sale.create({
          product_id: p.product_id,
          product_name: p.product_name,
          sell_price: p.sell_price,
          buy_price: product.purchase_price,
          quantity: p.quantity,
          total_price: p.sell_price * p.quantity,
          payment_method: "qarz",
          debtor_name: debtor.name,
          debtor_phone: debtor.phone,
          debt_due_date: debtor.due_date,
        });
      }

      await debtor.deleteOne();
      return res
        .status(200)
        .json({ message: "Qarz to'liq to'landi va sotuvlar yozildi" });
    }

    await debtor.save();
    res.status(200).json(debtor);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.getAllDebtors = async (req, res) => {
  try {
    const debtors = await Debtor.find().populate("products.product_id");
    res.status(200).json(debtors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.deleteDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    await Debtor.findByIdAndDelete(id);
    res.status(200).json({ message: "Qarzdor o'chirildi" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.vazvratDebt = async (req, res) => {
  try {
    const { quantity, id, product_id } = req.body;

    const numericQuantity = Number(quantity);
    if (!numericQuantity || isNaN(numericQuantity) || numericQuantity <= 0) {
      return res.status(400).json({ message: "Miqdor noto‘g‘ri kiritilgan" });
    }

    const debtor = await Debtor.findById(id);
    if (!debtor) return res.status(404).json({ message: "Qarzdor topilmadi" });

    const product = await Product.findById(product_id);
    if (!product)
      return res.status(404).json({ message: "Mahsulot topilmadi" });

    let storeProduct = await Store.findOne({ product_id });

    if (!storeProduct) {
      storeProduct = await Store.create({
        product_id: product._id,
        product_name: product.product_name,
        quantity: numericQuantity,
      });
    } else {
      storeProduct.quantity += numericQuantity;
      await storeProduct.save();
    }

    const prodIndex = debtor.products.findIndex((p) => {
      const pId =
        typeof p.product_id === "object"
          ? p.product_id._id?.toString()
          : p.product_id?.toString();
      return pId === product_id;
    });

    if (prodIndex === -1) {
      return res.status(404).json({ message: "Mahsulot qarzdorda topilmadi" });
    }

    const item = debtor.products[prodIndex];

    item.quantity -= numericQuantity;
    debtor.debt_amount -= item.sell_price * numericQuantity;

    if (item.quantity <= 0) {
      debtor.products.splice(prodIndex, 1);
    }

    await debtor.save();

    res.status(200).json({ message: "Mahsulot qaytarildi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const { id, amount, currency, rate, payment_method = "naqd" } = req.body;

    if (!id || !amount || !currency || !rate) {
      return res.status(400).json({ message: "Kerakli maydonlar to'liq emas" });
    }

    const debtor = await Debtor.findById(id);
    if (!debtor) {
      return res.status(404).json({ message: "Qarzdor topilmadi" });
    }

    if (!debtor.currency) {
      return res
        .status(400)
        .json({ message: "Qarzdor valyutasi belgilanmagan" });
    }

    // 1. Qarzdorning qarzini USDga o'giramiz
    const debtorAmountInUsd =
      debtor.currency === "usd"
        ? parseFloat(debtor.debt_amount)
        : parseFloat(debtor.debt_amount / rate);

    // 2. To'lovni USDga aylantiramiz
    const amountInUsd =
      currency === "usd" ? parseFloat(amount) : parseFloat(amount / rate);

    const remainingDebtUsd = debtorAmountInUsd - amountInUsd;

    // 3. Qolgan qarzni qarzdorning asl valyutasiga qaytaramiz
    const newDebtAmount =
      debtor.currency === "usd" ? remainingDebtUsd : remainingDebtUsd * rate;

    // ✅ TO'LOVNI PAYMENT_LOG'GA QO'SHISH (har doim!)
    debtor.payment_log.push({
      amount: parseFloat(amount),
      date: new Date(),
      currency,
    });

    // 4. Agar qarz to'liq to'langan bo'lsa
    if (remainingDebtUsd <= 0) {
      for (const item of debtor.products) {
        const product = await Product.findById(item.product_id);
        if (!product) continue;

        const storeItem = await Store.findOne({ product_id: item.product_id });

        if (!storeItem || storeItem.quantity < item.quantity) {
          return res.status(400).json({
            message: `Omborda ${item.product_name} uchun yetarli mahsulot yo'q`,
          });
        }

        // Ombordan mahsulotni ayiramiz
        storeItem.quantity -= item.quantity;
        await storeItem.save();

        // ✅ Mahsulotning asl valyutasini aniqlash
        const productCurrency = item.currency || debtor.currency || "sum";

        const total_price = item.sell_price * item.quantity;

        // Total price sum ni to'g'ri hisoblash
        const total_price_sum =
          productCurrency === "usd" ? total_price * rate : total_price;

        await Sale.create({
          product_id: product._id,
          product_name: item.product_name,
          sell_price: item.sell_price,
          buy_price: product.purchase_price,
          currency: productCurrency, // ✅ Mahsulotning asl valyutasi
          quantity: item.quantity,
          total_price,
          total_price_sum,
          payment_method,
          debtor_name: debtor.name,
          debtor_phone: debtor.phone,
          debt_due_date: debtor.due_date,
        });
      }

      // Qarzni to'liq yopamiz
      debtor.debt_amount = 0;
      debtor.products = [];
      // ❌ PAYMENT_LOG'NI O'CHIRMASLIK - tarixi saqlansin!
      // debtor.payment_log = [];
      await debtor.save();

      return res.status(200).json({
        message: "Qarz to'liq yopildi",
        payment_logged: true,
      });
    }

    // 5. Qisman to'lov bo'lsa
    debtor.debt_amount = newDebtAmount;
    await debtor.save();

    return res.status(200).json({
      message: "Qisman to'lov qabul qilindi",
      payment_logged: true,
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ message: "Serverda xatolik" });
  }
};

// ❌ Qarzdorni o‘chirish
exports.deleteDebtor = async (req, res) => {
  try {
    const { id } = req.params;
    const debtor = await Debtor.findById(id);
    if (!debtor) {
      return res.status(404).json({ message: "Qarzdor topilmadi" });
    }

    await debtor.deleteOne();
    res.status(200).json({ message: "Qarzdor o‘chirildi" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Qarzdor to'lovlari ro'yxatini olish
exports.getDebtorPayments = async (req, res) => {
  try {
    const debtors = await Debtor.find({ "payment_log.0": { $exists: true } })
      .select("name phone payment_log currency")
      .sort({ "payment_log.date": -1 });

    // Barcha to'lovlarni bir ro'yxatga yig'ish
    const payments = [];
    
    debtors.forEach((debtor) => {
      debtor.payment_log.forEach((payment) => {
        payments.push({
          _id: payment._id,
          debtor_name: debtor.name,
          debtor_phone: debtor.phone,
          debtor_id: debtor._id,
          amount: payment.amount,
          currency: payment.currency || debtor.currency || "sum",
          date: payment.date,
        });
      });
    });

    // Sanaga ko'ra tartiblash (eng yangi birinchi)
    payments.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json(payments);
  } catch (err) {
    console.error("Error fetching debtor payments:", err);
    res.status(500).json({ message: "Serverda xatolik" });
  }
};