import { sql } from "drizzle-orm";
import { clients } from "../../client/table";
import { initDatabase } from "../setup";

const sampleClients = [
	{ name: "John", surname: "Smith", email: "john.smith@example.com" },
	{ name: "Emma", surname: "Johnson", email: "emma.johnson@example.com" },
	{ name: "Michael", surname: "Williams", email: "michael.williams@example.com" },
	{ name: "Sarah", surname: "Brown", email: "sarah.brown@example.com" },
	{ name: "James", surname: "Jones", email: "james.jones@example.com" },
	{ name: "Emily", surname: "Garcia", email: "emily.garcia@example.com" },
	{ name: "David", surname: "Miller", email: "david.miller@example.com" },
	{ name: "Olivia", surname: "Davis", email: "olivia.davis@example.com" },
	{ name: "Robert", surname: "Martinez", email: "robert.martinez@example.com" },
	{ name: "Sophia", surname: "Anderson", email: "sophia.anderson@example.com" },
	{ name: "William", surname: "Taylor", email: "william.taylor@example.com" },
	{ name: "Ava", surname: "Thomas", email: "ava.thomas@example.com" },
	{ name: "Joseph", surname: "Moore", email: "joseph.moore@example.com" },
	{ name: "Isabella", surname: "Jackson", email: "isabella.jackson@example.com" },
	{ name: "Charles", surname: "White", email: "charles.white@example.com" },
	{ name: "Mia", surname: "Harris", email: "mia.harris@example.com" },
	{ name: "Thomas", surname: "Clark", email: "thomas.clark@example.com" },
	{ name: "Charlotte", surname: "Lewis", email: "charlotte.lewis@example.com" },
	{ name: "Daniel", surname: "Walker", email: "daniel.walker@example.com" },
	{ name: "Amelia", surname: "Hall", email: "amelia.hall@example.com" },
];

async function seedDb() {
	const db = initDatabase({
		host: process.env.DATABASE_HOST!,
		username: process.env.DATABASE_USERNAME!,
		password: process.env.DATABASE_PASSWORD!,
	});
	await db.execute(sql`SELECT 1`);
	await db.insert(clients).values(sampleClients).onConflictDoNothing();

	process.exit(0);
}

seedDb().catch((_error) => {
	process.exit(1);
});
