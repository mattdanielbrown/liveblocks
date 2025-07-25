"use client";

import {
  type BaseMetadata,
  type CommentData,
  type DM,
  Permission,
  type ThreadData,
} from "@liveblocks/core";
import {
  useMarkRoomThreadAsResolved,
  useMarkRoomThreadAsUnresolved,
  useRoomPermissions,
  useRoomThreadSubscription,
} from "@liveblocks/react/_private";
import * as TogglePrimitive from "@radix-ui/react-toggle";
import type {
  ComponentPropsWithoutRef,
  ForwardedRef,
  RefAttributes,
  SyntheticEvent,
} from "react";
import {
  forwardRef,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { GlobalComponents } from "../components";
import { ArrowDownIcon } from "../icons/ArrowDown";
import { BellIcon } from "../icons/Bell";
import { BellCrossedIcon } from "../icons/BellCrossed";
import { CheckCircleIcon } from "../icons/CheckCircle";
import { CheckCircleFillIcon } from "../icons/CheckCircleFill";
import type {
  CommentOverrides,
  ComposerOverrides,
  GlobalOverrides,
  ThreadOverrides,
} from "../overrides";
import { useOverrides } from "../overrides";
import { cn } from "../utils/cn";
import { findLastIndex } from "../utils/find-last-index";
import type { CommentProps } from "./Comment";
import { Comment } from "./Comment";
import type { ComposerProps } from "./Composer";
import { Composer } from "./Composer";
import { Button } from "./internal/Button";
import { DropdownItem } from "./internal/Dropdown";
import { Tooltip, TooltipProvider } from "./internal/Tooltip";

export interface ThreadProps<M extends BaseMetadata = DM>
  extends ComponentPropsWithoutRef<"div"> {
  /**
   * The thread to display.
   */
  thread: ThreadData<M>;

  /**
   * How to show or hide the composer to reply to the thread.
   */
  showComposer?: boolean | "collapsed";

  /**
   * Whether to show the action to resolve the thread.
   */
  showResolveAction?: boolean;

  /**
   * How to show or hide the actions.
   */
  showActions?: CommentProps["showActions"];

  /**
   * Whether to show reactions.
   */
  showReactions?: CommentProps["showReactions"];

  /**
   * Whether to show the composer's formatting controls.
   */
  showComposerFormattingControls?: ComposerProps["showFormattingControls"];

  /**
   * Whether to blur the composer editor when the composer is submitted.
   */
  blurComposerOnSubmit?: ComposerProps["blurOnSubmit"];

  /**
   * Whether to indent the comments' content.
   */
  indentCommentContent?: CommentProps["indentContent"];

  /**
   * Whether to show deleted comments.
   */
  showDeletedComments?: CommentProps["showDeleted"];

  /**
   * Whether to show attachments.
   */
  showAttachments?: boolean;

  /**
   * The event handler called when changing the resolved status.
   */
  onResolvedChange?: (resolved: boolean) => void;

  /**
   * The event handler called when a comment is edited.
   */
  onCommentEdit?: CommentProps["onCommentEdit"];

  /**
   * The event handler called when a comment is deleted.
   */
  onCommentDelete?: CommentProps["onCommentDelete"];

  /**
   * The event handler called when the thread is deleted.
   * A thread is deleted when all its comments are deleted.
   */
  onThreadDelete?: (thread: ThreadData<M>) => void;

  /**
   * The event handler called when clicking on a comment's author.
   */
  onAuthorClick?: CommentProps["onAuthorClick"];

  /**
   * The event handler called when clicking on a mention.
   */
  onMentionClick?: CommentProps["onMentionClick"];

  /**
   * The event handler called when clicking on a comment's attachment.
   */
  onAttachmentClick?: CommentProps["onAttachmentClick"];

  /**
   * The event handler called when the composer is submitted.
   */
  onComposerSubmit?: ComposerProps["onComposerSubmit"];

  /**
   * Override the component's strings.
   */
  overrides?: Partial<
    GlobalOverrides & ThreadOverrides & CommentOverrides & ComposerOverrides
  >;

  /**
   * Override the component's components.
   */
  components?: Partial<GlobalComponents>;
}

/**
 * Displays a thread of comments, with a composer to reply
 * to it.
 *
 * @example
 * <>
 *   {threads.map((thread) => (
 *     <Thread key={thread.id} thread={thread} />
 *   ))}
 * </>
 */
export const Thread = forwardRef(
  <M extends BaseMetadata = DM>(
    {
      thread,
      indentCommentContent = true,
      showActions = "hover",
      showDeletedComments,
      showResolveAction = true,
      showReactions = true,
      showComposer = "collapsed",
      showAttachments = true,
      showComposerFormattingControls = true,
      onResolvedChange,
      onCommentEdit,
      onCommentDelete,
      onThreadDelete,
      onAuthorClick,
      onMentionClick,
      onAttachmentClick,
      onComposerSubmit,
      blurComposerOnSubmit,
      overrides,
      components,
      className,
      ...props
    }: ThreadProps<M>,
    forwardedRef: ForwardedRef<HTMLDivElement>
  ) => {
    const markThreadAsResolved = useMarkRoomThreadAsResolved(thread.roomId);
    const markThreadAsUnresolved = useMarkRoomThreadAsUnresolved(thread.roomId);
    const $ = useOverrides(overrides);
    const firstCommentIndex = useMemo(() => {
      return showDeletedComments
        ? 0
        : thread.comments.findIndex((comment) => comment.body);
    }, [showDeletedComments, thread.comments]);
    const lastCommentIndex = useMemo(() => {
      return showDeletedComments
        ? thread.comments.length - 1
        : findLastIndex(thread.comments, (comment) => comment.body);
    }, [showDeletedComments, thread.comments]);
    const {
      status: subscriptionStatus,
      unreadSince,
      subscribe,
      unsubscribe,
    } = useRoomThreadSubscription(thread.roomId, thread.id);
    const unreadIndex = useMemo(() => {
      // The user is not subscribed to this thread.
      if (subscriptionStatus !== "subscribed") {
        return;
      }

      // The user hasn't read the thread yet, so all comments are unread.
      if (unreadSince === null) {
        return firstCommentIndex;
      }

      // The user has read the thread, so we find the first unread comment.
      const unreadIndex = thread.comments.findIndex(
        (comment) =>
          (showDeletedComments ? true : comment.body) &&
          comment.createdAt > unreadSince
      );

      return unreadIndex >= 0 && unreadIndex < thread.comments.length
        ? unreadIndex
        : undefined;
    }, [
      firstCommentIndex,
      showDeletedComments,
      subscriptionStatus,
      thread.comments,
      unreadSince,
    ]);
    const [newIndex, setNewIndex] = useState<number>();
    const newIndicatorIndex = newIndex === undefined ? unreadIndex : newIndex;

    useEffect(() => {
      if (unreadIndex) {
        // Keep the "new" indicator at the lowest unread index.
        setNewIndex((persistedUnreadIndex) =>
          Math.min(persistedUnreadIndex ?? Infinity, unreadIndex)
        );
      }
    }, [unreadIndex]);

    const permissions = useRoomPermissions(thread.roomId);
    const canComment =
      permissions.size > 0
        ? permissions.has(Permission.CommentsWrite) ||
          permissions.has(Permission.Write)
        : true;

    const stopPropagation = useCallback((event: SyntheticEvent) => {
      event.stopPropagation();
    }, []);

    const handleResolvedChange = useCallback(
      (resolved: boolean) => {
        onResolvedChange?.(resolved);

        if (resolved) {
          markThreadAsResolved(thread.id);
        } else {
          markThreadAsUnresolved(thread.id);
        }
      },
      [
        markThreadAsResolved,
        markThreadAsUnresolved,
        onResolvedChange,
        thread.id,
      ]
    );

    const handleCommentDelete = useCallback(
      (comment: CommentData) => {
        onCommentDelete?.(comment);

        const filteredComments = thread.comments.filter(
          (comment) => comment.body
        );

        if (filteredComments.length <= 1) {
          onThreadDelete?.(thread);
        }
      },
      [onCommentDelete, onThreadDelete, thread]
    );

    const handleSubscribeChange = useCallback(() => {
      if (subscriptionStatus === "subscribed") {
        unsubscribe();
      } else {
        subscribe();
      }
    }, [subscriptionStatus, subscribe, unsubscribe]);

    return (
      <TooltipProvider>
        <div
          className={cn(
            "lb-root lb-thread",
            showActions === "hover" && "lb-thread:show-actions-hover",
            className
          )}
          data-resolved={thread.resolved ? "" : undefined}
          data-unread={unreadIndex !== undefined ? "" : undefined}
          dir={$.dir}
          {...props}
          ref={forwardedRef}
        >
          <div className="lb-thread-comments">
            {thread.comments.map((comment, index) => {
              const isFirstComment = index === firstCommentIndex;
              const isUnread =
                unreadIndex !== undefined && index >= unreadIndex;

              const children = (
                <Comment
                  key={comment.id}
                  overrides={overrides}
                  className="lb-thread-comment"
                  data-unread={isUnread ? "" : undefined}
                  comment={comment}
                  indentContent={indentCommentContent}
                  showDeleted={showDeletedComments}
                  showActions={showActions}
                  showReactions={showReactions}
                  showAttachments={showAttachments}
                  showComposerFormattingControls={
                    showComposerFormattingControls
                  }
                  onCommentEdit={onCommentEdit}
                  onCommentDelete={handleCommentDelete}
                  onAuthorClick={onAuthorClick}
                  onMentionClick={onMentionClick}
                  onAttachmentClick={onAttachmentClick}
                  components={components}
                  autoMarkReadThreadId={
                    index === lastCommentIndex && isUnread
                      ? thread.id
                      : undefined
                  }
                  additionalActionsClassName={
                    isFirstComment ? "lb-thread-actions" : undefined
                  }
                  additionalActions={
                    isFirstComment && showResolveAction ? (
                      <Tooltip
                        content={
                          thread.resolved
                            ? $.THREAD_UNRESOLVE
                            : $.THREAD_RESOLVE
                        }
                      >
                        <TogglePrimitive.Root
                          pressed={thread.resolved}
                          onPressedChange={handleResolvedChange}
                          asChild
                        >
                          <Button
                            className="lb-comment-action"
                            onClick={stopPropagation}
                            aria-label={
                              thread.resolved
                                ? $.THREAD_UNRESOLVE
                                : $.THREAD_RESOLVE
                            }
                            icon={
                              thread.resolved ? (
                                <CheckCircleFillIcon />
                              ) : (
                                <CheckCircleIcon />
                              )
                            }
                            disabled={!canComment}
                          />
                        </TogglePrimitive.Root>
                      </Tooltip>
                    ) : null
                  }
                  additionalDropdownItemsBefore={
                    isFirstComment ? (
                      <DropdownItem
                        onSelect={handleSubscribeChange}
                        onClick={stopPropagation}
                        icon={
                          subscriptionStatus === "subscribed" ? (
                            <BellCrossedIcon />
                          ) : (
                            <BellIcon />
                          )
                        }
                      >
                        {subscriptionStatus === "subscribed"
                          ? $.THREAD_UNSUBSCRIBE
                          : $.THREAD_SUBSCRIBE}
                      </DropdownItem>
                    ) : null
                  }
                />
              );

              return index === newIndicatorIndex &&
                newIndicatorIndex !== firstCommentIndex &&
                newIndicatorIndex <= lastCommentIndex ? (
                <Fragment key={comment.id}>
                  <div
                    className="lb-thread-new-indicator"
                    aria-label={$.THREAD_NEW_INDICATOR_DESCRIPTION}
                  >
                    <span className="lb-thread-new-indicator-label">
                      <ArrowDownIcon className="lb-thread-new-indicator-label-icon" />
                      {$.THREAD_NEW_INDICATOR}
                    </span>
                  </div>
                  {children}
                </Fragment>
              ) : (
                children
              );
            })}
          </div>
          {showComposer && (
            <Composer
              className="lb-thread-composer"
              threadId={thread.id}
              defaultCollapsed={showComposer === "collapsed" ? true : undefined}
              showAttachments={showAttachments}
              showFormattingControls={showComposerFormattingControls}
              onComposerSubmit={onComposerSubmit}
              blurOnSubmit={blurComposerOnSubmit}
              overrides={{
                COMPOSER_PLACEHOLDER: $.THREAD_COMPOSER_PLACEHOLDER,
                COMPOSER_SEND: $.THREAD_COMPOSER_SEND,
                ...overrides,
              }}
              roomId={thread.roomId}
            />
          )}
        </div>
      </TooltipProvider>
    );
  }
) as <M extends BaseMetadata = DM>(
  props: ThreadProps<M> & RefAttributes<HTMLDivElement>
) => JSX.Element;
