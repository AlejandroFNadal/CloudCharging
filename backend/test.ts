import { performance } from "perf_hooks";
import supertest from "supertest";
import { buildApp } from "./app";

const app = supertest(buildApp());

async function basicLatencyTest() {
    await app.post("/reset").expect(204);
    const start = performance.now();
    await app.post("/charge").expect(200);
    await app.post("/charge").expect(200);
    await app.post("/charge").expect(200);
    await app.post("/charge").expect(200);
    await app.post("/charge").expect(200);
    console.log(`Latency: ${performance.now() - start} ms`);
    // latency in my machine is about 380ms. Part of this challenge is to keep it around that.
    if(performance.now() - start > 400){
        throw new Error("Latency too high");
    }
}

async function runOutAccount(){
    await app.post("/reset").send({account:"test"}).expect(204);
    const firstTransaction = await app.post("/charge").send({account: "test", charges: 15}).expect(200);
    if (firstTransaction.body.isAuthorized !== true && firstTransaction.body.remainingBalance !== 85) {
        throw new Error("Incorrect result");
    }
    const secondTransaction = await app.post("/charge").send({account: "test", charges: 86}).expect(200);
    if (secondTransaction.body.isAuthorized !== false && secondTransaction.body.remainingBalance !== 85) {
        throw new Error("Incorrect result");
    }
    console.log("Run out account test passed");
}
// The problem I see with the original code is that there are three queries without any locking.
// It is possible that a request A can happen, the balance is checked, then a request B happens, the balance is checked,
// then request A is processed, then request B is processed. This would result in a negative balance.

async function consecutiveRequests() {
    await app.post("/reset").send({account:"test"}).expect(204);
    const firstTransaction = app.post("/charge").send({account: "test", charges: 15}).expect(200);
    const secondTransaction = app.post("/charge").send({account: "test", charges: 86}).expect(200);
    const [firstResponse, secondResponse] = await Promise.all([firstTransaction, secondTransaction]);
    // Both cannot succeed
    if (firstResponse.body.isAuthorized === true && secondResponse.body.isAuthorized === true) {
        throw new Error("Incorrect result: both transactions succeeded");
    }
    // At least one must succeed
    if (firstResponse.body.isAuthorized === false && secondResponse.body.isAuthorized === false) {
        throw new Error("Incorrect result: both transactions failed");
    }
    console.log("Consecutive requests test passed");
}
async function runTests() {
    await basicLatencyTest();
    await runOutAccount();
    await consecutiveRequests();
}

runTests().catch(console.error);
