import test from 'ava'
import dotenv from 'dotenv-safe'

import * as types from './types'
import { ChatGPTAPI } from './chatgpt-api'

dotenv.config()

const isCI = !!process.env.CI

test('ChatGPTAPI invalid session token', async (t) => {
  t.timeout(30 * 1000) // 30 seconds

  t.throws(() => new ChatGPTAPI({ sessionToken: null, clearanceToken: null }), {
    message: 'ChatGPT invalid session token'
  })

  await t.throwsAsync(
    async () => {
      const chatgpt = new ChatGPTAPI({
        sessionToken: 'invalid',
        clearanceToken: 'invalid'
      })
      await chatgpt.initSession()
    },
    {
      instanceOf: types.ChatGPTError,
      message: 'ChatGPT failed to refresh auth token. Error: Unauthorized'
    }
  )
})

test('ChatGPTAPI valid session token', async (t) => {
  if (!isCI) {
    t.timeout(2 * 60 * 1000) // 2 minutes
  }

  t.notThrows(
    () =>
      new ChatGPTAPI({
        sessionToken: 'fake valid session token',
        clearanceToken: 'invalid'
      })
  )

  await t.notThrowsAsync(
    (async () => {
      const chatgpt = new ChatGPTAPI({
        sessionToken: process.env.SESSION_TOKEN,
        clearanceToken: process.env.CLEARANCE_TOKEN
      })

      // Don't make any real API calls using our session token if we're running on CI
      if (!isCI) {
        await chatgpt.initSession()
        const response = await chatgpt.sendMessage('test')
        console.log('chatgpt response', response)

        t.truthy(response)
        t.is(typeof response, 'string')
      }
    })()
  )
})

if (!isCI) {
  test('ChatGPTAPI expired session token', async (t) => {
    t.timeout(30 * 1000) // 30 seconds
    const expiredSessionToken = process.env.TEST_EXPIRED_SESSION_TOKEN

    await t.throwsAsync(
      async () => {
        const chatgpt = new ChatGPTAPI({
          sessionToken: expiredSessionToken,
          clearanceToken: 'invalid'
        })
        await chatgpt.initSession()
      },
      {
        instanceOf: types.ChatGPTError,
        message:
          'ChatGPT failed to refresh auth token. Error: session token may have expired'
      }
    )
  })
}

if (!isCI) {
  test('ChatGPTAPI timeout', async (t) => {
    t.timeout(30 * 1000) // 30 seconds

    await t.throwsAsync(
      async () => {
        const chatgpt = new ChatGPTAPI({
          sessionToken: process.env.SESSION_TOKEN,
          clearanceToken: process.env.CLEARANCE_TOKEN
        })

        await chatgpt.sendMessage('test', {
          timeoutMs: 1
        })
      },
      {
        message: 'ChatGPT timed out waiting for response'
      }
    )
  })

  test('ChatGPTAPI abort', async (t) => {
    t.timeout(30 * 1000) // 30 seconds

    await t.throwsAsync(
      async () => {
        const chatgpt = new ChatGPTAPI({
          sessionToken: process.env.SESSION_TOKEN,
          clearanceToken: process.env.CLEARANCE_TOKEN
        })

        const abortController = new AbortController()
        setTimeout(() => abortController.abort(new Error('testing abort')), 10)

        await chatgpt.sendMessage('test', {
          abortSignal: abortController.signal
        })
      },
      {
        message: 'testing abort'
      }
    )
  })
}
