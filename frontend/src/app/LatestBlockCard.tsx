import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@components/ui/table.tsx";
import { findBlocksWithGas } from "@database/repositories/block.repository.ts";
import { CubeIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import Link from "next/link";

import HomeCard from "./HomeCard";

async function getBlocks() {
  return findBlocksWithGas({
    size: 6,
  });
}

const LatestBlockCard = async () => {
  const blocks = await getBlocks();

  return (
    <HomeCard
      title={"Latest blocks"}
      footer={{
        text: "View all blocks",
        href: "/blocks",
      }}
    >
      <Table>
        <TableBody>
          {blocks.map((block) => {
            const txsFees =
              block.transactions?.reduce((acc, curr) => {
                const gasUsed = curr.receipt?.gasUsed || 0n;
                const gasPrice = curr.gasPrice || 0n;
                return acc + gasUsed * gasPrice;
              }, 0n) || 0n;

            return (
              <TableRow key={block.hash}>
                <TableCell className={"flex gap-2"}>
                  <div
                    className={
                      "flex bg-gray-500 w-10 h-10 items-center justify-center rounded"
                    }
                  >
                    <CubeIcon className={"w-5 text-white"} />
                  </div>
                  <div className={"flex flex-col justify-center"}>
                    <Link
                      href={`/block/${block.number.toString()}`}
                      className={"hover:text-blue-500"}
                    >
                      <span>{block.number.toString()}</span>
                    </Link>
                    <span className={"text-slate-500"}>
                      {dayjs(Number(block.createdAt) * 1000).fromNow()}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className={"flex flex-col"}>
                    <Link
                      href={`/block/${block.number.toString()}`}
                      className={"hover:text-blue-500"}
                    >
                      <span>{block.hash}</span>
                    </Link>
                    <Link
                      href={`/block/${block.number.toString()}/transactions`}
                      className={"hover:text-blue-500"}
                    >
                      <span>
                        <span className={"font-semibold"}>
                          {block.transactions.length}
                        </span>{" "}
                        txns
                      </span>
                    </Link>
                  </div>
                </TableCell>
                <TableCell>
                  <div
                    className={
                      "px-1 font-semibold bg-gray-500 text-slate-300 flex items-center justify-center rounded"
                    }
                  >
                    {txsFees.toString()} ETH
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </HomeCard>
  );
};

export default LatestBlockCard;
