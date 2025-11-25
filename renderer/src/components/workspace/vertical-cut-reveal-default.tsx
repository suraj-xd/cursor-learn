import VerticalCutReveal from "@/components/xd-ui/vertical-cut-reveal"
import { useUsername } from "@/hooks";
import { useEffect, useMemo } from "react";

const getTimeBasedEmoji = () => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 8) return "🌅"
  if (hour >= 8 && hour < 12) return "☀️"
  if (hour >= 12 && hour < 17) return "🌤️"
  if (hour >= 17 && hour < 20) return "🌇"
  if (hour >= 20 && hour < 22) return "🌆"
  return "🌙"
}

export default function Preview() {
  const { firstName, fetch } = useUsername();
  const weatherEmoji = useMemo(() => getTimeBasedEmoji(), [])

  useEffect(() => {
    fetch();
  }, [fetch]);
  return (
    <div className=" xs:text-2xl  text-2xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-5xl flex flex-col items-start justify-center font-overused-grotesk text-[#0015ff] dark:text-[#ADFF3F] tracking-wide uppercase">
      <VerticalCutReveal
        splitBy="characters"
        staggerDuration={0.025}
        staggerFrom="first"
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 21,
        }}
      >
        {`HI 👋, ${firstName ? firstName : 'FRIEND'}!`}
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
      >
        {`MEET 😊 YOU.`}
        (﹙˓ 📟 ˒﹚)
        ⌬
        ֎
        🗂️
        📜
        {`༘⋆📼˚ ༘ ೀ⋆｡˚`}
        🗃️
      </VerticalCutReveal>
    </div>
  )
}
