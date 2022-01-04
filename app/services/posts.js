import Service from '@ember/service';
import { action } from '@ember/object';
import { createMachine, assign, spawn, send } from 'xstate';
import { useMachine } from 'ember-statecharts';
import { schedule } from '@ember/runloop';

const postMachine = createMachine({
  initial: 'loading',
  states: {
    loading: {
      entry: [send('LOADED', { delay: 5000 })],
      on: {
        LOADED: 'loaded',
      },
    },
    loaded: {},
  },
});

const postsMachine = createMachine(
  {
    initial: 'active',

    context: {
      posts: [],
    },
    states: {
      active: {
        on: {
          LOAD_DETAILS: [
            {
              cond: 'detailsNeedLoading',
              actions: [
                assign({
                  posts: (context, { postId }) => [
                    ...context.posts,
                    {
                      id: postId,
                      ref: spawn(postMachine, { sync: true }),
                    },
                  ],
                }),
              ],
            },
          ],
        },
      },
    },
  },
  {
    guards: {
      detailsNeedLoading({ posts }, { postId }) {
        return !posts.filter((post) => post.id === postId).length;
      },
    },
  }
);

export default class PostsService extends Service {
  statechart = useMachine(this, () => {
    return {
      machine: postsMachine,
    };
  });

  get loadingPosts() {
    return this.statechart.state.context.posts.filter((post) => {
      return post.ref.state.matches('loading');
    });
  }

  get loadedPosts() {
    return this.statechart.state.context.posts.filter((post) => {
      return post.ref.state.matches('loaded');
    });
  }

  get loadedPostsIds() {
    return this.loadedPosts.map((p) => p.id);
  }

  get data() {
    const { loadingPosts, loadedPostsIds } = this;

    return {
      loadingPosts,
      loadedPostsIds,
    };
  }

  get fns() {
    const { loadDetails } = this;

    return {
      loadDetails,
    };
  }

  @action loadDetails(post) {
    schedule('actions', this, () => {
      this.statechart.send('LOAD_DETAILS', { postId: post.id });
    });
  }
}
