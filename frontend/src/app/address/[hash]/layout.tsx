import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@components/ui/breadcrumb.tsx";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";
import { isHex } from "viem";

type TransactionLayoutProps = {
  children: ReactElement;
  params: { hash: string };
};
const AddressLayout = async ({ children, params }: TransactionLayoutProps) => {
  const hash = params.hash;
  if (!hash || !isHex(hash)) {
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
            <BreadcrumbPage>Address</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{hash}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      {children}
    </div>
  );
};

export default AddressLayout;
