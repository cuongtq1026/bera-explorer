import { ArrowRightIcon } from "@heroicons/react/16/solid";
import Link from "next/link";
import type { ReactElement } from "react";

type HomeCardProps = {
  children: ReactElement | string;
  title: ReactElement | string;
  footer: {
    text: string;
    href: string;
  };
};
const HomeCard = ({ children, title, footer }: HomeCardProps) => {
  return (
    <div className={"bg-gray-200 rounded"}>
      <div className={"px-3 py-2 font-semibold"}>{title}</div>
      <div className={"p-1 border-y border-slate-400"}>{children}</div>
      <Link
        href={footer.href}
        className={
          "py-2 flex items-center justify-center hover:bg-gray-300 hover:text-blue-500"
        }
      >
        <div className={"flex gap-1 font-semibold items-center"}>
          {footer.text} <ArrowRightIcon className={"w-4"} />
        </div>
      </Link>
    </div>
  );
};

export default HomeCard;
