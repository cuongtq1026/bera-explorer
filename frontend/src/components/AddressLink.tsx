import { shortenEthAddress } from "@utils";
import Link from "next/link";

type AddressLinkProps = {
  address: string;
  shorten?: boolean;
  type: "address" | "token" | "transaction" | "block";
};
const AddressLink = ({ address, shorten, type }: AddressLinkProps) => {
  return (
    <Link
      href={`/${type}/${address}`}
      className={"font-semibold hover:text-blue-500"}
    >
      {shorten ? shortenEthAddress(address) : address}
    </Link>
  );
};

export default AddressLink;
