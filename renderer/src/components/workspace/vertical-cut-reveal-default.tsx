import VerticalCutReveal from "@/components/xd-ui/vertical-cut-reveal";
import { useUsername } from "@/hooks";
import { useEffect, useMemo } from "react";
import { APP_CONFIG } from "@/lib/config";
import { LandingAIInput } from "../landing-ai-input";

const getTimeBasedEmoji = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8) return "🌅";
  if (hour >= 8 && hour < 12) return "☀️";
  if (hour >= 12 && hour < 17) return "🌤️";
  if (hour >= 17 && hour < 20) return "🌇";
  if (hour >= 20 && hour < 22) return "🌆";
  return "🌙";
};

export default function Preview() {
  const { fetch, getDisplayName } = useUsername();
  const weatherEmoji = useMemo(() => getTimeBasedEmoji(), []);
  const displayName = getDisplayName();

  useEffect(() => {
    fetch();
  }, [fetch]);
  return (
    <div className="xs:text-sm text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl flex flex-col gap-5 items-start justify-center w-full font-overused-grotesk text-[#0015ff] dark:text-[#ADFF3F] tracking-wide uppercase py-10">
      {/* <div>
        <VerticalCutReveal
          splitBy="characters"
          staggerDuration={0.025}
          staggerFrom="first"
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 21,
          }}
          containerClassName="text-base sm:text-lg md:text-xl lg:text-2xl"
        >
          {`HI 👋, ${displayName ? displayName.toUpperCase() : "FRIEND"}!`}
        </VerticalCutReveal>
        <VerticalCutReveal
          splitBy="characters"
          staggerDuration={0.025}
          staggerFrom="last"
          reverse={true}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 21,
            delay: 0.5,
          }}
          containerClassName="text-base sm:text-lg md:text-xl lg:text-2xl"
        >
          {`${weatherEmoji} IT IS NICE ⇗ TO`}
        </VerticalCutReveal>
        <VerticalCutReveal
          splitBy="characters"
          staggerDuration={0.025}
          staggerFrom="center"
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 21,
            delay: 1.1,
          }}
          containerClassName="text-base sm:text-lg md:text-xl lg:text-2xl"
        >
          {`MEET 😊 YOU.`}
        </VerticalCutReveal>
      </div> */}
      <div className="w-full flex justify-center items-center flex-col">
        <VerticalCutReveal
          splitBy="characters"
          staggerDuration={0.025}
          staggerFrom="first"
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 21,
          }}
          containerClassName="text-lg sm:text-xl md:text-2xl lg:text-3xl"
        >
          {`Break down YOUR`}
        </VerticalCutReveal>
        <VerticalCutReveal
          splitBy="characters"
          staggerDuration={0.025}
          staggerFrom="last"
          reverse={true}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 21,
            delay: 0.5,
          }}
          containerClassName="font-medium text-black dark:text-white font-mono text-base sm:text-lg md:text-xl"
          wordLevelClassName=""
        >
          {`AGENTIC_CODING`}
        </VerticalCutReveal>
        <VerticalCutReveal
          splitBy="characters"
          staggerDuration={0.025}
          staggerFrom="center"
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 21,
            delay: 1.1,
          }}
          containerClassName="mt-1 text-[10px] sm:text-xs text-center text-muted-foreground font-light"
        >
          {`w // your cursor chat conversations`}
        </VerticalCutReveal>
      </div>
      <div className="py-6 flex-1 w-full flex justify-start items-center">
        <LandingAIInput />
      </div>
      <div className="w-full flex justify-center items-center flex-col max-w-2xl mx-auto">
        <p className="text-xs text-center text-muted-foreground font-light font-departure">
          We turn your coding sessions into distilled programming insights.
        </p>
      </div>
    </div>
  );
}
// 📟
