import type { AiAssistantMessage, WithNavigation } from "@liveblocks/core";
import {
  type ComponentProps,
  forwardRef,
  memo,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import { ComponentsProvider, type GlobalComponents } from "../../components";
import { ChevronRightIcon } from "../../icons/ChevronRight";
import { WarningIcon } from "../../icons/Warning";
import {
  type AiChatMessageOverrides,
  type GlobalOverrides,
  OverridesProvider,
  useOverrides,
} from "../../overrides";
import * as AiMessage from "../../primitives/AiMessage";
import { AiMessageToolInvocation } from "../../primitives/AiMessage/tool-invocation";
import type {
  AiMessageContentReasoningPartProps,
  AiMessageContentTextPartProps,
  AiMessageContentToolInvocationPartProps,
} from "../../primitives/AiMessage/types";
import * as Collapsible from "../../primitives/Collapsible";
import { cn } from "../../utils/cn";
import { ErrorBoundary } from "../../utils/ErrorBoundary";
import { Prose } from "./Prose";

type UiAssistantMessage = WithNavigation<AiAssistantMessage>;

/* -------------------------------------------------------------------------------------------------
 * AiChatAssistantMessage
 * -----------------------------------------------------------------------------------------------*/
export interface AiChatAssistantMessageProps extends ComponentProps<"div"> {
  /**
   * The message to display.
   */
  message: UiAssistantMessage;

  /**
   * Override the component's strings.
   */
  overrides?: Partial<GlobalOverrides & AiChatMessageOverrides>;

  /**
   * Override the component's components.
   */
  components?: Partial<GlobalComponents>;

  /**
   * @internal
   * The id of the copilot to use to set tool call result.
   */
  copilotId?: string;
}

export const AiChatAssistantMessage = memo(
  forwardRef<HTMLDivElement, AiChatAssistantMessageProps>(
    (
      { message, className, overrides, components, copilotId, ...props },
      forwardedRef
    ) => {
      const $ = useOverrides(overrides);

      let children: ReactNode = null;

      if (message.deletedAt !== undefined) {
        children = (
          <div className="lb-ai-chat-message-deleted">
            {$.AI_CHAT_MESSAGE_DELETED}
          </div>
        );
      } else if (
        message.status === "generating" ||
        message.status === "awaiting-tool"
      ) {
        if (message.contentSoFar.length === 0) {
          children = (
            <div className="lb-ai-chat-message-thinking lb-ai-chat-pending">
              {$.AI_CHAT_MESSAGE_THINKING}
            </div>
          );
        } else {
          children = (
            <AssistantMessageContent message={message} copilotId={copilotId} />
          );
        }
      } else if (message.status === "completed") {
        children = (
          <AssistantMessageContent message={message} copilotId={copilotId} />
        );
      } else if (message.status === "failed") {
        // Do not include the error message if the user aborted the request.
        if (message.errorReason === "Aborted by user") {
          children = (
            <AssistantMessageContent message={message} copilotId={copilotId} />
          );
        } else {
          children = (
            <>
              <AssistantMessageContent
                message={message}
                copilotId={copilotId}
              />

              <div className="lb-ai-chat-message-error">
                <span className="lb-icon-container">
                  <WarningIcon />
                </span>
                {message.errorReason}
              </div>
            </>
          );
        }
      }

      return (
        <div
          className={cn(
            "lb-ai-chat-message lb-ai-chat-assistant-message",
            className
          )}
          {...props}
          ref={forwardedRef}
        >
          <OverridesProvider overrides={overrides}>
            <ComponentsProvider components={components}>
              {children}
            </ComponentsProvider>
          </OverridesProvider>
        </div>
      );
    }
  )
);

function AssistantMessageContent({
  message,
  copilotId,
}: {
  message: UiAssistantMessage;
  copilotId?: string;
}) {
  return (
    <AiMessage.Content
      message={message}
      components={{
        TextPart,
        ReasoningPart,
        ToolInvocationPart,
      }}
      copilotId={copilotId}
      className="lb-ai-chat-message-content"
    />
  );
}

/* -------------------------------------------------------------------------------------------------
 * TextPart
 * -----------------------------------------------------------------------------------------------*/
function TextPart({ part }: AiMessageContentTextPartProps) {
  return <Prose content={part.text} className="lb-ai-chat-message-text" />;
}

/* -------------------------------------------------------------------------------------------------
 * ReasoningPart
 * -----------------------------------------------------------------------------------------------*/
function ReasoningPart({
  part,
  isStreaming,
}: AiMessageContentReasoningPartProps) {
  // Start collapsed if reasoning is already done.
  const [isOpen, setIsOpen] = useState(isStreaming);
  const $ = useOverrides();

  // Auto-collapse when reasoning is done, while still allowing the user to
  // open/collapse it manually during and after it's done.
  useEffect(() => {
    if (!isStreaming) {
      setIsOpen(false);
    }
  }, [isStreaming]);

  return (
    <Collapsible.Root
      className="lb-collapsible lb-ai-chat-message-reasoning"
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <Collapsible.Trigger
        className={cn(
          "lb-collapsible-trigger",
          isStreaming && "lb-ai-chat-pending"
        )}
      >
        {/* TODO: Show duration as "Reasoned for x seconds"? */}
        {$.AI_CHAT_MESSAGE_REASONING(isStreaming)}
        <span className="lb-collapsible-chevron lb-icon-container">
          <ChevronRightIcon />
        </span>
      </Collapsible.Trigger>

      <Collapsible.Content className="lb-collapsible-content">
        <Prose content={part.text} />
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

/* -------------------------------------------------------------------------------------------------
 * ToolInvocationPart
 * -----------------------------------------------------------------------------------------------*/
function ToolInvocationPart({
  part,
  message,
  copilotId,
}: AiMessageContentToolInvocationPartProps) {
  return (
    <div className="lb-ai-chat-message-tool-invocation">
      <ErrorBoundary
        fallback={
          <div className="lb-ai-chat-message-error">
            <span className="lb-icon-container">
              <WarningIcon />
            </span>
            <p>
              Failed to render tool call result for <code>{part.name}</code>.
              See console for details.
            </p>
          </div>
        }
      >
        <AiMessageToolInvocation
          part={part}
          message={message}
          copilotId={copilotId}
        />
      </ErrorBoundary>
    </div>
  );
}
