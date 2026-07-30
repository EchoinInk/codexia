"use client";

import {
  useEffect,
  useRef,
  useState
} from "react";

import { Markdown } from "./Markdown";
import { DiffView } from "./DiffView";

import {
  ArrowUp,
  Bot,
  User,
  Wrench,
  Check,
  X
} from "lucide-react";


type Msg =
  | {
      role: "user" | "assistant";
      content: string;
    }
  | {
      role: "tool";
      tool: string;
      data: unknown;
    };


type PendingDiff = {
  path: string;
  oldText: string;
  newText: string;
};



export function Chat({
  onWorkspaceChanged
}: {
  onWorkspaceChanged?: () => void;
}) {


  const [
    messages,
    setMessages
  ] = useState<Msg[]>([]);



  const [
    input,
    setInput
  ] = useState("");



  const [
    busy,
    setBusy
  ] = useState(false);



  const [
    pendingDiff,
    setPendingDiff
  ] = useState<PendingDiff | null>(null);



  const scrollRef =
    useRef<HTMLDivElement>(null);



  useEffect(() => {

    scrollRef.current?.scrollTo({

      top:
        scrollRef.current.scrollHeight,

      behavior:
        "smooth"

    });

  }, [
    messages,
    busy
  ]);





  const send = async () => {
  const text = input.trim();

  if (!text || busy) {
    return;
  }

  const next: Msg[] = [
    ...messages,
    {
      role: "user",
      content: text,
    },
  ];

  setMessages(next);
  setInput("");
  setBusy(true);

  const history = next
    .filter(
      (
        m
      ): m is Extract<
        Msg,
        {
          role: "user" | "assistant";
          content: string;
        }
      > =>
        m.role === "user" ||
        m.role === "assistant"
    )
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 30000);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: history,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();

      throw new Error(
        `HTTP ${res.status}\n${text}`
      );
    }

    const data = await res.json();

    console.log("Agent response:", data);

    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        content:
          data.content ??
          "**Agent returned an empty response.**",
      },
    ]);
  } catch (error: unknown) {
    clearTimeout(timeout);

    let message = "Unknown error";

    if (
      error instanceof DOMException &&
      error.name === "AbortError"
    ) {
      message =
        "The request timed out after 30 seconds. The planner is probably stuck.";
    } else if (error instanceof Error) {
      message = error.message;
    } else {
      message = String(error);
    }

    console.error("Chat request failed:", error);

    setMessages((current) => [
      ...current,
      {
        role: "assistant",
        content: `**Error:** ${message}`,
      },
    ]);
  } finally {
    clearTimeout(timeout);
    setBusy(false);
  }
};





  const onKey =
    (
      e: React.KeyboardEvent<HTMLTextAreaElement>
    ) => {

      if(
        e.key === "Enter" &&
        !e.shiftKey
      ){

        e.preventDefault();

        send();

      }

    };





  return (

    <div
      className="
      bg-white
      rounded-2xl
      shadow-card
      border
      border-ink-400/10
      flex
      flex-col
      h-full
      overflow-hidden
      "
    >


      <div
        className="
        px-6
        py-4
        border-b
        border-ink-400/10
        flex
        items-center
        justify-between
        "
      >

        <div>

          <div
            className="
            text-ink-900
            font-bold
            "
          >
            Conversation
          </div>


          <div
            className="
            text-xs
            text-ink-500
            "
          >
            Connected to your local Codexia agent
          </div>

        </div>



        <div
          className="
          text-[11px]
          text-ink-500
          font-mono
          bg-ink-400/10
          px-2
          py-1
          rounded
          "
        >
          system: Codexia
        </div>


      </div>





      <div
        ref={scrollRef}
        className="
        flex-1
        overflow-y-auto
        px-6
        py-6
        space-y-5
        "
      >


        {
          messages.length === 0 && (

            <div
              className="
              text-center
              text-ink-500
              mt-20
              "
            >

              <Bot
                className="
                mx-auto
                mb-3
                text-brand
                "
                size={28}
              />


              <div
                className="
                font-semibold
                text-ink-900
                "
              >
                Hi, I&apos;m Codexia.
              </div>


              <div
                className="
                text-sm
                mt-1
                "
              >
                Ask me to read, edit, or generate code in your workspace.
              </div>


            </div>

          )

        }





        {
          messages.map(
            (
              m,
              i
            ) => {


              if(
                m.role === "tool"
              ){

                return (

                  <div
                    key={i}
                    className="
                    flex
                    gap-3
                    "
                  >

                    <div
                      className="
                      w-8
                      h-8
                      rounded-full
                      bg-amber-100
                      text-amber-700
                      flex
                      items-center
                      justify-center
                      "
                    >

                      <Wrench size={15}/>

                    </div>



                    <div
                      className="
                      bg-amber-50
                      border
                      border-amber-200/60
                      rounded-xl
                      px-4
                      py-2
                      text-[13px]
                      text-amber-900
                      font-mono
                      "
                    >

                      <span className="font-semibold">
                        {m.tool}
                      </span>


                    </div>


                  </div>

                );

              }





              return (

                <div
                  key={i}
                  className="
                  flex
                  gap-3
                  "
                >

                  <div
                    className={`
                    w-8
                    h-8
                    rounded-full
                    shrink-0
                    flex
                    items-center
                    justify-center
                    ${
                      m.role === "user"
                      ? "bg-ink-400/15 text-ink-700"
                      : "bg-brand-50 text-brand"
                    }
                    `}
                  >

                    {
                      m.role === "user"
                      ?
                      <User size={15}/>
                      :
                      <Bot size={15}/>
                    }

                  </div>




                  <div
                    className="
                    flex-1
                    min-w-0
                    "
                  >

                    {
                      m.role === "user"
                      ?

                      <div
                        className="
                        text-ink-900
                        text-[14.5px]
                        whitespace-pre-wrap
                        leading-relaxed
                        "
                      >
                        {m.content}
                      </div>


                      :

                      <Markdown>
                        {m.content}
                      </Markdown>

                    }

                  </div>


                </div>

              );

            }
          )

        }



        {
          busy && (

            <div
              className="
              text-ink-500
              text-lg
              "
            >
              <span>•</span>
              <span>•</span>
              <span>•</span>
            </div>

          )
        }


      </div>





      {
        pendingDiff && (

          <PendingDiffBar

            diff={
              pendingDiff
            }


            onApply={
              async () => {

                await fetch(
                  "/api/fs/write",
                  {

                    method:"POST",

                    headers:{
                      "Content-Type":
                        "application/json"
                    },


                    body:
                      JSON.stringify({

                        path:
                          pendingDiff.path,

                        content:
                          pendingDiff.newText

                      })

                  }
                );


                setPendingDiff(null);

                onWorkspaceChanged?.();

              }
            }



            onDiscard={
              () =>
                setPendingDiff(null)
            }

          />

        )
      }






      <div
        className="
        border-t
        border-ink-400/10
        p-4
        "
      >

        <div
          className="
          flex
          items-end
          gap-2
          bg-[#f4f7fe]
          rounded-2xl
          p-2
          border
          border-ink-400/10
          "
        >

          <textarea

            value={
              input
            }


            onChange={
              e =>
                setInput(
                  e.target.value
                )
            }


            onKeyDown={
              onKey
            }


            placeholder="
            Ask Codexia to read, write, or refactor code…
            "


            rows={1}


            className="
            flex-1
            bg-transparent
            outline-none
            resize-none
            px-3
            py-2
            text-[14.5px]
            text-ink-900
            "
          />



          <button

            onClick={
              send
            }


            disabled={
              busy ||
              !input.trim()
            }


            className="
            w-9
            h-9
            rounded-xl
            bg-brand
            text-white
            flex
            items-center
            justify-center
            disabled:opacity-40
            "
          >

            <ArrowUp size={17}/>

          </button>


        </div>

      </div>



    </div>

  );

}





function PendingDiffBar({
  diff,
  onApply,
  onDiscard
}: {
  diff:PendingDiff;
  onApply:()=>void;
  onDiscard:()=>void;
}) {


  const [
    open,
    setOpen
  ] =
    useState(true);



  return (

    <div
      className="
      border-t
      border-ink-400/10
      bg-brand-50/40
      px-6
      py-4
      "
    >

      <div
        className="
        flex
        items-center
        justify-between
        "
      >

        <div
          className="
          font-semibold
          "
        >

          Proposed edit:

          <span
            className="
            font-mono
            text-brand
            ml-2
            "
          >
            {diff.path}
          </span>

        </div>


        <div
          className="
          flex
          gap-2
          "
        >

          <button
            onClick={() => setOpen(!open)}
          >
            {open ? "Hide" : "Show"}
          </button>


          <button
            onClick={onDiscard}
          >
            <X size={13}/>
          </button>


          <button
            onClick={onApply}
          >
            <Check size={13}/>
          </button>


        </div>


      </div>




      {
        open && (

          <DiffView
            oldText={diff.oldText}
            newText={diff.newText}
          />

        )
      }


    </div>

  );

}