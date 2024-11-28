import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LotteryModule = buildModule("LotteryModule", (m) => {
    const ticketPrice = m.getParameter("ticketPrice", ONE_GWEI);
    const vaultWallet = m.getParameter("vaultWallet");
    const feeWallet = m.getParameter("feeWallet");

    const lottery = m.contract("WeeklyLottery", [
        ticketPrice,
        vaultWallet,
        feeWallet
    ]);

    return { lottery };
});