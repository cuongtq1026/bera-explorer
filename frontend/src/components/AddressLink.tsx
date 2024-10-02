import { shortenEthAddress } from "@utils";
import Link from "next/link";

type AddressLinkProps = {
  address: string;
  shorten?: boolean;
};
const AddressLink = ({ address, shorten }: AddressLinkProps) => {
  return (
    <Link
      href={`/address/${address}`}
      className={"font-semibold hover:text-blue-500"}
    >
      {shorten ? shortenEthAddress(address) : address}
    </Link>
  );
};

export default AddressLink;
