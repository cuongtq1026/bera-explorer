import type { ReactElement } from "react";

type HomeCardProps = {
  children: ReactElement;
  title: ReactElement;
};
const HomeCard = ({ children, title }: HomeCardProps) => {
  return (
    <div>
      <div>{title}</div>
      <div>{children}</div>
    </div>
  );
};

export default HomeCard;
