import { Menu } from "lucide-react";
import { AccountDialog } from "@/components/auth/account-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

interface HeaderProps {
	className?: string;
	onMobileMenuToggle?: () => void;
}

export function Header({ className, onMobileMenuToggle }: HeaderProps) {
	const { data: session } = authClient.useSession();

	const user = session?.user;
	const fallbackText = user?.name
		? user.name.charAt(0).toUpperCase()
		: user?.email?.charAt(0).toUpperCase() || "U";

	return (
		<header
			className={cn(
				"flex h-16 items-center justify-between border-b border-border bg-background px-6",
				className,
			)}
		>
			{/* Left side - Mobile menu button */}
			<div className="flex items-center">
				<Button variant="ghost" size="icon" className="lg:hidden" onClick={onMobileMenuToggle}>
					<Menu className="h-5 w-5 text-foreground" />
				</Button>
			</div>

			{/* Right side - User menu */}
			<div className="flex items-center gap-2">
				<AccountDialog>
					<Button variant="ghost" className="flex items-center gap-2 px-3">
						<Avatar className="h-8 w-8">
							<AvatarImage src={user?.image || undefined} alt={user?.name || "User"} />
							<AvatarFallback className="bg-primary text-primary-foreground text-sm">
								{fallbackText}
							</AvatarFallback>
						</Avatar>
						<div className="hidden sm:flex flex-col items-start">
							<span className="text-sm font-medium text-foreground">{user?.name || "User"}</span>
							<span className="text-xs text-muted-foreground">Online</span>
						</div>
					</Button>
				</AccountDialog>
			</div>
		</header>
	);
}
