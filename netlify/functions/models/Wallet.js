const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  balance: { type: Number, default: 0 },
  history: [
    {
      amount: Number,
      createdAt: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.models.Wallet || mongoose.model("Wallet", walletSchema);
