"use client";

import React, { useEffect, useState } from "react";

interface ApiResultCalloutProps {
  result?: { message: string; auditId?: string | null; warnings?: string[] } | null;
  error?: { message: string; details?: string | null; validationErrors?: string[] | null } | null;
}

export function ApiResultCallout({ result, error }: ApiResultCalloutProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (result || error) {
      setVisible(true);
    }
  }, [result, error]);

  if (!visible || (!result && !error)) {
    return null;
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
        <p className="font-semibold">{error.message}</p>
        {error.details ? <p className="mt-1">{error.details}</p> : null}
        {error.validationErrors?.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {error.validationErrors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
      <p className="font-semibold">{result.message}</p>
      {result.auditId ? <p className="mt-1 text-xs">Audit reference: {result.auditId}</p> : null}
      {result.warnings?.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-emerald-800">
          {result.warnings.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
