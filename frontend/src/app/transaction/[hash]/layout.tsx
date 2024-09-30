import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@components/ui/breadcrumb.tsx";
import { Button } from "@components/ui/button.tsx";
import { findTransaction } from "@database/repositories/transaction.repository.ts";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { type Hash, isHash } from "viem";

async function getTransaction(transactionHash: Hash) {
  return findTransaction(transactionHash);
}

type TransactionLayoutProps = {
  children: ReactElement;
  params: { hash: string };
};
const TransactionLayout = async ({
  children,
  params,
}: TransactionLayoutProps) => {
  const hash = params.hash;
  if (!hash || !isHash(hash)) {
    notFound();
  }
  const transaction = await getTransaction(hash);
  if (!transaction) {
    notFound();
  }

  return (
    <div className={"grid gap-2"}>
      <Breadcrumb>
        <BreadcrumbList className={"text-2xl font-bold"}>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              href={`/block/${transaction.blockNumber}/transactions`}
            >
              Transactions
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{hash}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className={"font-semibold flex"}>
        <Link
          href={`/transaction/${transaction.hash}`}
          className={"hover:text-blue-500 py-2 pr-2"}
        >
          <div>Overview</div>
        </Link>
        <Link
          href={`/transaction/${transaction.hash}/internal`}
          className={"hover:text-blue-500 p-2"}
        >
          <div>Internal txns</div>
        </Link>
        <Link
          href={`/transaction/${transaction.hash}/logs`}
          className={"hover:text-blue-500 py-2 pl-2"}
        >
          <div>Logs</div>
        </Link>
      </div>
      {children}
    </div>
  );
};

export default TransactionLayout;
