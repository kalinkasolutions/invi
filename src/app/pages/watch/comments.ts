import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { InvidiousApi } from '../../api/invidious-api';
import { Comment } from '../../api/types';
import { Avatar } from '../../shared/avatar';
import { formatCount } from '../../shared/format';
import { ListStatus } from '../../shared/list-status';
import { Pager } from '../../shared/pager';
import { RichText } from '../../shared/rich-text';

function commentPager(api: InvidiousApi, videoId: string, firstContinuation?: string) {
  return new Pager<Comment, string>(
    (continuation) =>
      api.comments(videoId, continuation ?? firstContinuation).pipe(
        map((page) => ({ items: page.comments, next: page.continuation })),
      ),
    (comment) => comment.commentId,
  );
}

@Component({
  selector: 'app-comment',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Avatar, RichText, ListStatus],
  template: `
    <app-avatar [src]="comment().authorThumbnail" [name]="comment().author" />
    <div class="body">
      <p class="meta">
        <a [routerLink]="['/channel', comment().authorId]" [class.owner]="comment().authorIsChannelOwner">
          {{ comment().author }}
        </a>
        {{ comment().publishedText }}{{ comment().isEdited ? ' (edited)' : '' }}
        @if (comment().isPinned) {
          · Pinned
        }
      </p>
      <div class="content rich-text" appRichText [currentVideoId]="videoId()" (seek)="seek.emit($event)"
           [innerHTML]="comment().contentHtml"></div>
      @if (comment().likeCount) {
        <p class="meta">{{ likes() }} likes</p>
      }
      @if (replies(); as replies) {
        <div class="replies">
          @for (reply of replies.items(); track reply.commentId) {
            <app-comment [comment]="reply" [videoId]="videoId()" (seek)="seek.emit($event)" />
          }
          <app-list-status [list]="replies" [isEmpty]="!replies.items().length" moreText="More replies" />
        </div>
      } @else if (comment().replies; as info) {
        <button class="link" (click)="showReplies(info.continuation)">
          {{ info.replyCount }} {{ info.replyCount === 1 ? 'reply' : 'replies' }}
        </button>
      }
    </div>
  `,
  styleUrl: './comments.css',
})
export class CommentView {
  readonly comment = input.required<Comment>();
  readonly videoId = input.required<string>();
  readonly seek = output<number>();

  private readonly api = inject(InvidiousApi);
  protected readonly replies = signal<Pager<Comment, string> | null>(null);
  protected readonly likes = computed(() => formatCount(this.comment().likeCount));

  protected showReplies(continuation: string): void {
    this.replies.set(commentPager(this.api, this.videoId(), continuation));
  }
}

@Component({
  selector: 'app-comments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommentView, ListStatus],
  template: `
    @for (comment of pager().items(); track comment.commentId) {
      <app-comment [comment]="comment" [videoId]="videoId()" (seek)="seek.emit($event)" />
    }
    <app-list-status [list]="pager()" [isEmpty]="!pager().items().length" emptyText="No comments."
                     moreText="Load more comments" />
  `,
  styles: `:host { display: flex; flex-direction: column; gap: 1.25rem; }`,
})
export class Comments {
  readonly videoId = input.required<string>();
  readonly seek = output<number>();

  private readonly api = inject(InvidiousApi);
  protected readonly pager = computed(() => commentPager(this.api, this.videoId()));
}
