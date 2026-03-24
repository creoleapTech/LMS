import crypto from "crypto"

export interface PhonePeConfig {
  merchantId: string
  saltKey: string
  saltIndex: number
  baseUrl: string // UAT: https://api-preprod.phonepe.com/apis/pg-sandbox or PROD: https://api.phonepe.com/apis/hermes
}

export interface PaymentRequest {
  merchantTransactionId: string
  amount: number // in paise (1 rupee = 100 paise)
  merchantUserId: string
  redirectUrl: string
  redirectMode: "POST" | "REDIRECT"
  callbackUrl: string
  mobileNumber?: string
  deviceContext?: {
    deviceOS: string
  }
}

export interface PaymentResponse {
  success: boolean
  code: string
  message: string
  data?: {
    merchantId: string
    merchantTransactionId: string
    transactionId: string
    amount: number
    state: string
    responseCode: string
    paymentInstrument?: {
      type: string
      utr?: string
    }
  }
}

export class PhonePeService {
  private config: PhonePeConfig
  merchantId: any
  saltKey: string
  saltIndex: string

  constructor(config: PhonePeConfig) {
    this.config = config
  }

  /**
   * Generate X-VERIFY header for PhonePe API authentication
   */
  private generateXVerify(payload: string, endpoint: string): string {
    const string = payload + endpoint + this.config.saltKey
    const sha256 = crypto.createHash("sha256").update(string).digest("hex")
    return `${sha256}###${this.config.saltIndex}`
  }

  /**
   * Initiate payment with PhonePe
   */
  async initiatePayment(paymentRequest: PaymentRequest): Promise<{
    success: boolean
    data?: {
      instrumentResponse: {
        redirectInfo: {
          url: string
          method: string
        }
      }
    }
    message?: string
  }> {
    try {
      const paymentPayload = {
        merchantId: this.config.merchantId,
        merchantTransactionId: paymentRequest.merchantTransactionId,
        merchantUserId: paymentRequest.merchantUserId,
        amount: paymentRequest.amount,
        redirectUrl: paymentRequest.redirectUrl,
        redirectMode: paymentRequest.redirectMode,
        callbackUrl: paymentRequest.callbackUrl,
        paymentInstrument: {
          type: "PAY_PAGE",
        },
        ...(paymentRequest.mobileNumber && { mobileNumber: paymentRequest.mobileNumber }),
        ...(paymentRequest.deviceContext && { deviceContext: paymentRequest.deviceContext }),
      }

      const base64Payload = Buffer.from(JSON.stringify(paymentPayload)).toString("base64")
      const endpoint = "/pg/v1/pay"
      const xVerify = this.generateXVerify(base64Payload, endpoint)

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerify,
          accept: "application/json",
        },
        body: JSON.stringify({
          request: base64Payload,
        }),
      })

      const result = await response.json()

      if (result.success) {
        return {
          success: true,
          data: result.data,
        }
      } else {
        return {
          success: false,
          message: result.message || "Payment initiation failed",
        }
      }
    } catch (error) {
      console.error("PhonePe payment initiation error:", error)
      return {
        success: false,
        message: "Internal server error",
      }
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(merchantTransactionId: string): Promise<PaymentResponse> {
    try {
      const endpoint = `/pg/v1/status/${this.config.merchantId}/${merchantTransactionId}`
      const xVerify = this.generateXVerify("", endpoint)

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerify,
          accept: "application/json",
        },
      })

      const result = await response.json()

      return {
        success: result.success,
        code: result.code,
        message: result.message,
        data: result.data,
      }
    } catch (error) {
      console.error("PhonePe status check error:", error)
      return {
        success: false,
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to check payment status",
      }
    }
  }

  /**
   * Verify callback signature
   */
  verifyCallback(xVerify: string, response: string): boolean {
    try {
      const [receivedHash, receivedSaltIndex] = xVerify.split("###")

      if (receivedSaltIndex === undefined || Number.parseInt(receivedSaltIndex) !== this.config.saltIndex) {
        return false
      }

      const expectedHash = crypto
        .createHash("sha256")
        .update(response + this.config.saltKey)
        .digest("hex")

      return receivedHash === expectedHash
    } catch (error) {
      console.error("Callback verification error:", error)
      return false
    }
  }

  /**
   * Generate unique merchant transaction ID
   */
  generateTransactionId(prefix = "TXN"): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `${prefix}_${timestamp}_${random}`
  }
}
