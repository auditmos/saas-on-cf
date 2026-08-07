import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PendingApproval } from "@/components/auth/pending-approval";
import { selectAuthView } from "@/core/auth-view";

describe("selectAuthView", () => {
	it("treats a missing session as signed out", () => {
		expect(selectAuthView(null)).toBe("signed-out");
		expect(selectAuthView(undefined)).toBe("signed-out");
		expect(selectAuthView({ user: null })).toBe("signed-out");
	});

	it("treats a valid session on an unapproved account as pending approval, not signed out", () => {
		expect(selectAuthView({ user: { approved: false } })).toBe("pending-approval");
		expect(selectAuthView({ user: {} })).toBe("pending-approval");
	});

	it("authorizes only an explicitly approved account", () => {
		expect(selectAuthView({ user: { approved: true } })).toBe("authorized");
		// Better Auth surfaces additional fields untyped; a truthy-but-not-true
		// value must not be read as approval.
		expect(selectAuthView({ user: { approved: "yes" } })).toBe("pending-approval");
	});
});

describe("the pending-approval interface", () => {
	const markup = renderToStaticMarkup(
		createElement(PendingApproval, { email: "pending@example.com", onSignOut: () => {} }),
	);

	it("tells the user their account is awaiting approval", () => {
		expect(markup).toContain("Account Pending");
		expect(markup).toContain("awaiting admin approval");
	});

	it("shows them as signed in rather than signed out", () => {
		expect(markup).toContain("Signed in as");
		expect(markup).toContain("pending@example.com");
		expect(markup).not.toMatch(/sign in|signed out/i);
	});
});
