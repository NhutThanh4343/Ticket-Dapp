import assert from "node:assert/strict";
import { network } from "hardhat";
import { createTicketService } from "../../src/services/ticketService.js";
import { IntegrationError } from "../../src/blockchain/errors.js";

const { ethers, networkHelpers } = await network.create({ network: "hardhatMainnet" });

describe("TourTicket frontend service with the merged contract", function () {
  it("creates, purchases and uses ticket ID zero against the simulated EVM", async function () {
    const [admin, buyer] = await ethers.getSigners();
    const contract = await ethers.deployContract("TourTicketContract");
    await contract.waitForDeployment();
    const chain = await ethers.provider.getNetwork();
    const config = {
      chainId: chain.chainId,
      rpcUrl: "http://localhost:8545", // Unused: the test supplies the simulated provider.
      contractAddress: await contract.getAddress(),
      adminAddress: admin.address,
      deploymentBlock: 0,
    };
    let signer = admin;
    let revision = 0;
    const wallet = {
      getSession: async () => ({ signer, account: signer.address, chainId: chain.chainId, revision }),
      assertSession: async (session: { revision: number }) => {
        if (session.revision !== revision) throw new IntegrationError("WALLET_CHANGED", "Test wallet changed");
      },
    };
    const service = createTicketService({ getConfig: () => config, wallet, readProvider: ethers.provider });
    try {
      assert.deepEqual(await service.listTours(), []);
      assert.equal(await service.readAdmin(), admin.address);
      const price = ethers.parseEther("0.01");
      const input = { name: "Tour integration", departureTime: BigInt(await networkHelpers.time.latest()) + 3600n, price, totalTickets: 2n };
      const created = await service.createTour(input);
      assert.equal(created.tourId, 0n);

      signer = buyer;
      revision++;
      await assert.rejects(service.createTour(input), { code: "Unauthorized" });
      const adminBalance = await ethers.provider.getBalance(admin.address);
      const purchased = await service.purchaseTicket(0n);
      assert.equal(purchased.ticketId, 0n);
      assert.equal(await ethers.provider.getBalance(admin.address), adminBalance + price);
      assert.equal((await service.readTour(0n)).soldTickets, 1n);
      const owned = await service.listMyTickets();
      assert.equal(owned.length, 1);
      assert.equal(owned[0].owner, buyer.address);
      assert.equal(owned[0].isUsed, false);
      assert.equal((await service.readTicket(0n)).owner, buyer.address);
      assert.equal((await service.listTickets()).length, 1);

      signer = admin;
      revision++;
      await service.useTicket(0n);
      signer = buyer;
      revision++;
      assert.equal((await service.listMyTickets())[0].isUsed, true);
      assert.equal((await service.readTour(0n)).soldTickets, 1n);
    } finally {
      service.destroy();
    }
  });
});
