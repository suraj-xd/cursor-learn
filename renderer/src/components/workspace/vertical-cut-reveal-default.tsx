import { useUsername } from "@/hooks";
import { useEffect } from "react";
import { LandingAIInput } from "../landing-ai-input";

export default function Preview() {
  const { fetch } = useUsername();

  useEffect(() => {
    fetch();
  }, [fetch]);
  return (
    <div className="xs:text-sm text-sm sm:text-lg md:text-xl lg:text-2xl xl:text-3xl flex flex-col gap-5 items-start justify-center w-full font-overused-grotesk text-[#0015ff] dark:text-[#ADFF3F] tracking-wide uppercase py-10">
      {/* <div className="w-full flex justify-center items-center flex-col">
        <div className="text-lg sm:text-xl md:text-2xl lg:text-3xl">
          {`Break down YOUR`}
        </div>
        <div className="font-medium text-black dark:text-white font-mono text-base sm:text-lg md:text-xl">
          {`AGENTIC_CODING`}
        </div>
        <div className="mt-1 text-[10px] sm:text-xs text-center text-muted-foreground font-light">
          {`w // your cursor chat conversations`}
        </div>
      </div> */}
      <div className="py-6 flex-1 w-full flex justify-start items-center">
        <LandingAIInput />
      </div>
      {/* <div className="w-full flex justify-center items-center flex-col max-w-2xl mx-auto">
        <p className="text-xs text-center text-muted-foreground font-light font-departure">
          We turn your coding sessions into distilled programming insights.
        </p>
      </div> */}
    </div>
  );
}
// 📟
