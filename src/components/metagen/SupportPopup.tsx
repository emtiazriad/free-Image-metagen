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
          {/* <div className="mx-auto mb-4 flex items-center justify-center">
            <img
              src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcHJ6OHN1Z2t3NXZqbGJ5eW5pY3VhbGNqZzN4ZnBqaGtmcTN6MnRxZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0MYt5jPR6QX5pnqM/giphy.gif"
              alt="Thank you animation"
              className="h-32 w-auto rounded-lg"
            />
          </div> */}
          <DialogTitle className="text-xl">Love Free-ImageMetagen? 💖</DialogTitle>
          <DialogDescription className="text-base">
           সমস্যা–০১: কিছু ত্রুটির কারণে PNG এবং SVG ফাইলে embedded metadata সঠিকভাবে কাজ করবে না। তবে embedded metadata ব্যবহার করে ফাইল renaming এবং CSV ফিচার ঠিকভাবে কাজ করবে। JPG/JPEG ফাইলের ক্ষেত্রে কোনো সমস্যা নেই।
ত্রুটি সমাধানের কাজ চলমান আছে। অনুগ্রহ করে কিছু সময় দিয়ে সহযোগিতা করবেন। এছাড়া অন্য কোনো ত্রুটি লক্ষ্য করলে অবশ্যই জানাবেন। 🙏
            <p>Problem-01: Due to some issues, embedded metadata will not work properly for PNG and SVG files. However, using embedded metadata for file renaming and CSV operations will work correctly. There is no problem with JPG/JPEG files.
The issue is being fixed, so please allow some time and cooperate. If you notice any other issues, be sure to let us know.</p>
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
