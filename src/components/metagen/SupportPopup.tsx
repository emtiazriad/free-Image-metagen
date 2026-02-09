import { useEffect, useState } from "react";
import { Heart, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const POPUP_DELAY_MS = 5000;
const POPUP_SHOWN_KEY = "metagen_support_popup_shown";

export function SupportPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Only show once per session
    const alreadyShown = sessionStorage.getItem(POPUP_SHOWN_KEY);
    if (alreadyShown) return;

    const timer = setTimeout(() => {
      setOpen(true);
      sessionStorage.setItem(POPUP_SHOWN_KEY, "1");
    }, POPUP_DELAY_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md animate-scale-in">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <img
              src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHJ6OHN1Z2t3NXZqbGJ5eW5pY3VhbGNqZzN4ZnBqaGtmcTN6MnRxZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0MYt5jPR6QX5pnqM/giphy.gif"
              alt="Thank you animation"
              className="h-32 w-auto rounded-lg"
            />
          </div>
          <DialogTitle className="text-xl">Love Free-ImageMetagen? 💖</DialogTitle>
          <DialogDescription className="text-base">
            If this tool saves you time, consider supporting the project to keep it free and improving!
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-4">
          <Button
            variant="hero"
            size="lg"
            className="w-full gap-2"
            asChild
          >
            <a href="https://www.supportkori.com/emtiaz" target="_blank" rel="noopener noreferrer">
              <Heart className="h-5 w-5 fill-current" />
              Support This Project
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-muted-foreground"
          >
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
