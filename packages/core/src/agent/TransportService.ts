import type { AgentMessage } from './AgentMessage'
import type { EnvelopeKeys } from './EnvelopeService'
import type { AgentContext } from './context'
import type { DidDocument } from '../modules/dids'
import type { EncryptedMessage } from '../types'

import { DID_COMM_TRANSPORT_QUEUE } from '../constants'
import { AriesFrameworkError } from '../error'
import { injectable } from '../plugins'

@injectable()
export class TransportService {
  public transportSessionTable: TransportSessionTable = {}

  public saveSession(session: TransportSession) {
    if (session.type === 'WebSocket' && session.connectionId) {
      const oldSessions = this.getWebSocketSessionsForConnectionId(session.connectionId)
      oldSessions.forEach((oldSession) => {
        if (oldSession) {
          this.removeSession(oldSession)
        }
      })
    }
    this.transportSessionTable[session.id] = session
  }

  public findSessionByConnectionId(connectionId: string) {
    return Object.values(this.transportSessionTable).find((session) => session?.connectionId === connectionId)
  }

  public setConnectionIdForSession(sessionId: string, connectionId: string) {
    const session = this.findSessionById(sessionId)
    if (!session) {
      throw new AriesFrameworkError(`Session not found with id ${sessionId}`)
    }
    session.connectionId = connectionId
    this.saveSession(session)
  }

  public hasInboundEndpoint(didDocument: DidDocument): boolean {
    return Boolean(didDocument.service?.find((s) => s.serviceEndpoint !== DID_COMM_TRANSPORT_QUEUE))
  }

  public findSessionById(sessionId: string) {
    return this.transportSessionTable[sessionId]
  }

  public removeSession(session: TransportSession) {
    delete this.transportSessionTable[session.id]
  }

  private getWebSocketSessionsForConnectionId(connectionId: string) {
    return Object.values(this.transportSessionTable).filter(
      (session) => session?.connectionId === connectionId && session.type === 'WebSocket'
    )
  }
}

interface TransportSessionTable {
  [sessionId: string]: TransportSession | undefined
}

// In the framework Transport sessions are used for communication. A session is
// associated with a connection and it can be reused when we want to respond to
// a message. If the message, for example, does not contain any way to reply to
// this message, the session should be closed. When a new sequence of messages
// starts it can be used again. A session will be deleted when a WebSocket
// closes, for the WsTransportSession that is.
export interface TransportSession {
  // unique identifier for a transport session. This can a uuid, or anything else, as long
  // as it uniquely identifies a transport.
  id: string

  // The type is something that explicitly defines the transport type. For WebSocket it would
  // be "WebSocket" and for HTTP it would be "HTTP".
  type: string

  // The enveloping keys that can be used during the transport. This is used so the framework
  // does not have to look up the associated keys for sending a message.
  keys?: EnvelopeKeys

  // A received message that will be used to check whether it has any return routing.
  inboundMessage?: AgentMessage

  // A stored connection id used to find this session via the `TransportService` for a specific connection
  connectionId?: string

  // Send an encrypted message
  send(agentContext: AgentContext, encryptedMessage: EncryptedMessage): Promise<void>

  // Close the session to prevent dangling sessions.
  close(): Promise<void>
}
