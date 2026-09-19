"use client";

import {
  useEffect,
  useRef,
  useSyncExternalStore
} from "react";

import { Markdown } from "./Markdown";
import { EngineeringReview } from "./EngineeringReview";
import type { EngineeringSessionClient } from "@/lib/engineering/session";
import type { ChatSessionClient } from "@/lib/chat/session";

import { ArrowUp, Bot, User, X } from "lucide-react";


export function Chat({ engineering, conversation }: {
  engineering: EngineeringSessionClient;
  conversation: ChatSessionClient;
}) {
  const state = useSyncExternalStore(conversation.subscribe, conversation.getSnapshot, conversation.getSnapshot);
  const { messages, input, busy, selectedFile } = state;



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





  const send = () => void conversation.send(engineering);





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
                Ask me to inspect files or propose reviewed edits to named existing files.
              </div>


            </div>

          )

        }





        {
          messages.map(
            (
              m
            ) => {


              return (

                <div
                  key={m.id}
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



        <EngineeringReview session={engineering} />

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

            value={input}


            onChange={
              e => conversation.setInput(e.target.value)
            }


            onKeyDown={
              onKey
            }


            placeholder="Ask Codexia to inspect code or propose a reviewed edit…"


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

        {selectedFile && (
          <div className="mt-2 flex items-center gap-2 px-2 text-xs text-ink-500">
            <span>Context: <code>{selectedFile}</code></span>
            <button aria-label="Clear selected file context" onClick={() => conversation.selectFile(undefined)}><X size={12}/></button>
          </div>
        )}

      </div>



    </div>

  );

}
