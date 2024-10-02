import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@components/ui/breadcrumb.tsx";
import { Progress } from "@components/ui/progress.tsx";
import { findBlocksWithGas } from "@database/repositories/block.repository.ts";
import dayjs from "dayjs";
import Link from "next/link";
import { formatUnits } from "viem";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

async function getBlocks() {
  return findBlocksWithGas();
}

const BlockPage = async () => {
  const blocks = await getBlocks();

  return (
    <div className={"grid gap-2"}>
      <Breadcrumb>
        <BreadcrumbList className={"text-2xl font-bold"}>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/blocks">Blocks</BreadcrumbLink>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Block</TableHead>
            <TableHead>Txn</TableHead>
            <TableHead>Hash</TableHead>
            <TableHead>Gas Used</TableHead>
            <TableHead>Gas Limit</TableHead>
            <TableHead>Txn Fees</TableHead>
            <TableHead>Age</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {blocks.map((block) => {
            const gasUsedPercent =
              Number(block.gasUsed) / (Number(block.gasLimit) / 100);
            const txsFees =
              block.transactions?.reduce((acc, curr) => {
                const gasUsed = curr.receipt?.gasUsed || 0n;
                const gasPrice = curr.gasPrice || 0n;
                return acc + gasUsed * gasPrice;
              }, 0n) || 0n;
            return (
              <TableRow key={block.number}>
                <TableCell>
                  <Link
                    className={"hover:text-blue-500"}
                    href={`/block/${block.number.toString()}`}
                  >
                    {block.number.toString()}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    className={"hover:text-blue-500"}
                    href={`/block/${block.number.toString()}/transactions`}
                  >
                    {block.transactions.length}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    className={"hover:text-blue-500"}
                    href={`/block/${block.number.toString()}`}
                  >
                    {block.hash}
                  </Link>
                </TableCell>
                <TableCell>
                  {block.gasUsed.toLocaleString()}{" "}
                  <span className={"text-gray-400 text-sm"}>
                    ({gasUsedPercent.toFixed(2)}
                    %)
                  </span>
                  <Progress value={gasUsedPercent} className="w-[60%]" />
                </TableCell>
                <TableCell>{block.gasLimit.toLocaleString()}</TableCell>
                <TableCell>{formatUnits(txsFees, 18)}</TableCell>
                <TableCell>
                  {dayjs(Number(block.createdAt) * 1000).fromNow()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default BlockPage;
