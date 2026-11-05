import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { DateTimePicker } from "@/components/date-time-picker";

// o primeiro dia (05) não tem horário livre; o segundo (06) tem
vi.mock("@/lib/api.functions", () => ({
  getAvailability: async () => ({
    ok: true,
    data: [
      { date: "2099-10-05", open: true, slots: [] },
      { date: "2099-10-06", open: true, slots: ["09:00", "09:30"] },
    ],
  }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Harness({ onDate }: { onDate: (d: string) => void }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  return (
    <DateTimePicker
      serviceIds={["corte"]}
      date={date}
      time={time}
      onChange={(d, t) => {
        setDate(d);
        setTime(t);
        onDate(d);
      }}
    />
  );
}

describe("escolha do dia e do horário", () => {
  it("já marca o primeiro dia que tem horário livre e mostra os horários", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const picked: string[] = [];
    await act(async () => {
      createRoot(container).render(<Harness onDate={(d) => picked.push(d)} />);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(picked.at(-1)).toBe("2099-10-06");
    const buttons = [...container.querySelectorAll("button")].map((b) => b.textContent);
    expect(buttons).toContain("09:00");
    expect(buttons).toContain("09:30");
  });
});
